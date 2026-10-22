#!/usr/bin/env python3
"""Read the resume PDF in resume/ and write data/resume.json for the site.

Usage:  python3 tools/parse_resume.py [path/to/resume.pdf] [output.json]

With no argument it uses the PDF in resume/ (if there are several, the most
recently committed one). Needs pdfplumber:  pip install pdfplumber
"""
import json
import re
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'data' / 'resume.json'

SECTIONS = {
    'summary': ['summary', 'objective', 'profile', 'about me', 'about'],
    'skills': ['skills', 'technologies', 'tech stack', 'competencies', 'technical expertise'],
    'experience': ['experience', 'employment', 'work history', 'internship', 'internships'],
    'projects': ['projects', 'project work'],
    'education': ['education', 'academic background', 'academics', 'qualifications'],
    'awards': ['achievements', 'awards', 'honors', 'honours', 'accomplishments'],
    'certifications': ['certifications', 'certificates', 'certification', 'courses', 'training', 'licenses'],
    'other': ['languages', 'interests', 'hobbies', 'references', 'publications', 'volunteer',
              'extracurricular', 'activities', 'declaration', 'personal details', 'strengths'],
}
BULLET = re.compile(r'^\s*[•●▪◦‣➢►■\-–*]\s+')
MONTH = r'(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?'
DATE = re.compile(
    rf'(?:{MONTH}\s*)?(?:19|20)\d{{2}}\s*(?:–|—|-|to)\s*(?:(?:{MONTH}\s*)?(?:19|20)\d{{2}}|present|current|now|ongoing)'
    rf'|(?:{MONTH}\s*)(?:19|20)\d{{2}}', re.I)
YEAR = re.compile(r'\b(?:19|20)\d{2}\b')
SEP = re.compile(r'\s+[–—|]\s+|\s+-\s+|\s+at\s+')
EMAIL = re.compile(r'[\w.+-]+@[\w-]+\.[\w.]+')
PHONE = re.compile(r'\+?\d[\d\s()-]{8,}\d')
LINKEDIN = re.compile(r'(?:https?://)?(?:www\.)?linkedin\.com/in/[\w-]+/?', re.I)
GITHUB = re.compile(r'(?:https?://)?(?:www\.)?github\.com/[\w-]+/?', re.I)
URL = re.compile(r'(?:https?://)?(?:www\.)?[\w-]+\.(?:dev|io|me|tech|com|in|xyz|site|app)(?:/[\w/-]*)?', re.I)
DEGREE = re.compile(r'\b(b\.?\s?tech|m\.?\s?tech|bachelor|master|b\.?\s?sc|m\.?\s?sc|b\.?e\b|m\.?e\b|bca|mca|mba|ph\.?d|diploma|'
                    r'high school|senior secondary|secondary|class\s+(?:x|xii|10|12)|hsc|ssc|intermediate)', re.I)
SCHOOL = re.compile(r'(university|college|institute|school|academy|iit|nit|iiit)', re.I)
# tech names worth spotting in project text even when the skills section doesn't list them
COMMON_TECH = ['Llama', 'Whisper', 'LangChain', 'TensorFlow', 'Keras', 'scikit-learn', 'Hugging Face', 'Transformers',
               'React', 'Next.js', 'Node.js', 'Express', 'Django', 'FastAPI', 'Flask', 'MongoDB', 'PostgreSQL', 'MySQL',
               'SQLite', 'Redis', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'Firebase', 'TypeScript', 'JavaScript', 'Go', 'Rust',
               'Kotlin', 'Swift', 'Flutter', 'Unity', 'ROS', 'MATLAB', 'Netdiscover', 'Nmap', 'Wireshark', 'socket',
               'LM Studio', 'Streamlit', 'Gradio', 'YOLO', 'OpenCV', 'Arduino', 'ESP32', 'Raspberry Pi', 'MQTT']
SCORE = re.compile(r'((?:c?gpa|cpi|sgpa|percentage|score|marks)\s*[:\-]?\s*[\d.]+\s*(?:/\s*[\d.]+|%)?'
                   r'|[\d.]+\s*(?:/\s*10\s*)?(?:c?gpa|cpi|sgpa)\b|[\d.]+\s*%)', re.I)


def pick_pdf():
    if len(sys.argv) > 1:
        return Path(sys.argv[1]).resolve()
    pdfs = sorted((ROOT / 'resume').glob('*.pdf'))
    if not pdfs:
        sys.exit('No PDF found in resume/. Put your resume there.')
    if len(pdfs) == 1:
        return pdfs[0]

    def committed(p):
        try:
            out = subprocess.run(['git', 'log', '-1', '--format=%ct', '--', str(p)], cwd=ROOT,
                                 capture_output=True, text=True).stdout.strip()
            return int(out) if out else 0
        except OSError:
            return 0
    return max(pdfs, key=lambda p: (committed(p), p.stat().st_mtime))


def read_lines(path):
    """Lines with text, left edge, font size and boldness, across all pages."""
    lines = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for ln in page.extract_text_lines(x_tolerance=1.5, y_tolerance=3, return_chars=True):
                text = ln['text'].strip()
                if not text:
                    continue
                chars = [c for c in ln['chars'] if c['text'].strip()]
                sizes = [round(c['size'], 1) for c in chars] or [0]
                bold = sum('bold' in c['fontname'].lower() for c in chars) / max(1, len(chars))
                lines.append({'text': text, 'x0': ln['x0'], 'size': max(sizes), 'avg': sum(sizes) / len(sizes), 'bold': bold > .6})
    return lines


def norm(s):
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z& ]', ' ', s.lower())).strip()


def heading_of(line, body_size):
    text = line['text']
    words = text.split()
    if len(words) > 5 or BULLET.match(text) or text.endswith(('.', ',')) or ':' in text:
        return None
    looks = text.isupper() or line['bold'] or line['size'] > body_size + .8
    if not looks:
        return None
    n = norm(text)
    for key, aliases in SECTIONS.items():
        if any(re.search(rf'\b{re.escape(a)}\b', n) for a in aliases):
            return key
    return None


def split_top(s, sep=','):
    """Split on commas that aren't inside parentheses."""
    out, depth, cur = [], 0, ''
    for ch in s:
        depth += ch in '([' and 1 or ch in ')]' and -1 or 0
        if ch == sep and depth <= 0:
            out.append(cur)
            cur = ''
        else:
            cur += ch
    out.append(cur)
    return [x.strip(' .;') for x in out if x.strip(' .;')]


def join(a, b):
    if a.endswith('-') and b[:1].islower():
        return a[:-1] + b
    if a.endswith('-'):
        return a + b
    return f'{a} {b}'


def take_dates(text):
    m = DATE.search(text)
    if not m:
        return text, ''
    dates = re.sub(r'\s*(–|—|-|to)\s*', '–', m.group(0).strip())
    rest = (text[:m.start()] + text[m.end():]).strip(' ,|–—-')
    return rest, dates


def blocks(lines):
    """Group a section's lines into entries: {head: [lines], bullets: [text]}.
    Bullets start with a bullet glyph, or (when the PDF draws bullets as shapes, not text) are indented lines.
    An indented line that looks like the rest of an unfinished sentence continues the previous bullet."""
    if not lines:
        return []
    margin = min(l['x0'] for l in lines)
    entries, cur = [], None
    for l in lines:
        t = l['text']
        if BULLET.match(t):
            if cur is None:
                cur = {'head': [], 'bullets': []}
                entries.append(cur)
            cur['bullets'].append(BULLET.sub('', t).strip())
        elif l['x0'] > margin + 6 and cur is not None:
            prev = cur['bullets'][-1] if cur['bullets'] else None
            continues = prev is not None and (t[:1].islower() or not prev.rstrip().endswith(('.', '!', '?', ')', '%')))
            if continues:
                cur['bullets'][-1] = join(prev, t)
            else:
                cur['bullets'].append(t)
        else:
            if cur is None or cur['bullets']:
                cur = {'head': [], 'bullets': []}
                entries.append(cur)
            cur['head'].append(t)
    return entries


def parse(path):
    lines = read_lines(path)
    body = Counter(round(l['avg']) for l in lines).most_common(1)[0][0]
    warnings = []

    header, sections, current = [], {}, None
    for l in lines:
        key = heading_of(l, body)
        if key:
            current = key
            sections.setdefault(key, [])
            continue
        if current is None:
            header.append(l)
        elif current != 'other':
            sections[current].append(l)

    data = {'source': '', 'generated': datetime.now(timezone.utc).isoformat(timespec='seconds')}

    # ---- header
    all_text = '\n'.join(l['text'] for l in lines)
    head_text = '\n'.join(l['text'] for l in header) or all_text
    if header:
        name_line = max(header, key=lambda l: l['size'])
        data['name'] = name_line['text']
        rest = [l['text'] for l in header if l is not name_line]
    else:
        data['name'] = lines[0]['text'] if lines else ''
        rest = []
        warnings.append('No header found before the first section; guessed the name from the first line.')

    def contact_bit(s):
        return EMAIL.search(s) or PHONE.search(s) or LINKEDIN.search(s) or GITHUB.search(s)
    title_line = next((s for s in rest if not contact_bit(s)), '')
    data['titleParts'] = [p.strip() for p in re.split(r'\s*[|•·]\s*', title_line) if p.strip()]
    data['title'] = ' · '.join(data['titleParts'])

    for key, rx in (('email', EMAIL), ('phone', PHONE), ('linkedin', LINKEDIN), ('github', GITHUB)):
        m = rx.search(head_text) or rx.search(all_text)
        data[key] = m.group(0).strip().rstrip('/') if m else ''
    data['location'] = ''
    for s in rest:
        if s == title_line:
            continue
        for part in re.split(r'\s*[|•·]\s*', s):
            if part and not contact_bit(part) and not URL.fullmatch(part) and re.search(r'[a-z]', part, re.I):
                data['location'] = part
                break
        if data['location']:
            break
    site = next((m.group(0) for s in rest for m in [URL.search(s)]
                 if m and 'linkedin' not in m.group(0) and 'github' not in m.group(0) and '@' not in s[max(0, m.start() - 1):m.start() + 1]), '')
    data['website'] = site if site and not EMAIL.search(site) else ''

    # ---- summary
    data['summary'] = ''
    for l in sections.get('summary', []):
        data['summary'] = join(data['summary'], l['text']).strip() if data['summary'] else l['text']

    # ---- skills
    skills = []
    for l in sections.get('skills', []):
        t = BULLET.sub('', l['text'])
        m = re.match(r'^([^:]{2,40}):\s*(.*)$', t)
        if m:
            skills.append({'label': m.group(1).strip(), 'items': split_top(m.group(2))})
        elif skills and (l['x0'] > min(x['x0'] for x in sections['skills']) + 6 or t[:1].islower() or skills[-1]['items'] and not t.endswith(':')):
            skills[-1]['items'] += split_top(t)
        else:
            skills.append({'label': 'Skills', 'items': split_top(t)})
    data['skills'] = [s for s in skills if s['items']]
    vocab = {re.sub(r'\s*\(.*\)', '', x) for s in data['skills'] for x in s['items'] if len(x) > 1}
    vocab = sorted(vocab | {t for t in COMMON_TECH if t.lower() not in {v.lower() for v in vocab}}, key=len, reverse=True)

    # ---- experience
    data['experience'] = []
    for e in blocks(sections.get('experience', [])):
        head = ' '.join(e['head'])
        head, dates = take_dates(head)
        parts = [p.strip(' ,') for p in SEP.split(head, maxsplit=1)] if SEP.search(head) else [head]
        if len(parts) == 1 and len(e['head']) > 1:
            first, dates1 = take_dates(e['head'][0])
            second, dates2 = take_dates(' '.join(e['head'][1:]))
            parts, dates = [first, second], dates or dates1 or dates2
        if not head and not e['bullets']:
            continue
        data['experience'].append({'title': parts[0], 'subtitle': parts[1] if len(parts) > 1 else '', 'dates': dates, 'bullets': e['bullets']})

    # ---- projects
    data['projects'] = []
    for e in blocks(sections.get('projects', [])):
        head, dates = take_dates(' '.join(e['head']))
        name, stack = head, []
        m = re.match(r'^(.*?)\s*(?:[–—|:]|\s-\s)\s*(.+)$', head)
        if m and ',' in m.group(2):
            name, stack = m.group(1), split_top(m.group(2))
        elif m and len(m.group(2).split()) <= 4:
            name, stack = m.group(1), [m.group(2)]
        if not name and e['bullets']:
            name, e['bullets'] = e['bullets'][0], e['bullets'][1:]
        if not stack:
            text = ' '.join(e['bullets']).lower()
            for v in vocab:
                if re.search(rf'(?<![\w]){re.escape(v.lower())}(?![\w])', text) and not any(v.lower() in s.lower() for s in stack):
                    stack.append(v)
            stack = stack[:6]
        data['projects'].append({'name': name.strip(), 'stack': stack, 'dates': dates, 'bullets': e['bullets']})

    # ---- education
    data['education'] = []
    cur = None
    for l in sections.get('education', []):
        t = BULLET.sub('', l['text'])
        t, dates = take_dates(t)
        if not dates and (m := re.search(r'(?:^|[\s,(])((?:19|20)\d{2})\)?\s*$|,\s*((?:19|20)\d{2})\s*,', t)):
            dates = m.group(1) or m.group(2)
            t = (t[:m.start()] + (', ' if m.group(2) else '') + t[m.end():]).strip(' ,|–—-')
        score = SCORE.search(t)
        if score:
            t = (t[:score.start()] + t[score.end():]).strip(' ,|–—-')
        if cur is None or (DEGREE.search(t) and cur.get('degree')) or (SCHOOL.search(t) and cur.get('school') and not DEGREE.search(t) and cur.get('degree')):
            cur = {'degree': '', 'school': '', 'score': '', 'dates': ''}
            data['education'].append(cur)
        # "Degree, School" on one line
        if t and DEGREE.search(t) and SCHOOL.search(t) and not cur['degree']:
            parts = [x.strip() for x in t.split(',')]
            si = next((i for i, x in enumerate(parts) if SCHOOL.search(x) and i > 0), None)
            if si is not None:
                cur['degree'], cur['school'] = ', '.join(parts[:si]), ', '.join(parts[si:])
                t = ''
        if t:
            if DEGREE.search(t) and not cur['degree']:
                cur['degree'] = t
            elif SCHOOL.search(t) and not cur['school']:
                cur['school'] = t
            elif not cur['degree']:
                cur['degree'] = t
            elif not cur['school']:
                cur['school'] = t
        if score:
            cur['score'] = score.group(0).strip()
        if dates:
            cur['dates'] = dates
    data['education'] = [e for e in data['education'] if e['degree'] or e['school']]

    # ---- awards and certifications
    def items(key):
        out = []
        for e in blocks(sections.get(key, [])):
            # a block of plain lines with no bullets: one award/certificate per line
            for text in (e['head'] if not e['bullets'] else [' '.join(e['head'])] if e['head'] else []) + e['bullets']:
                if not text:
                    continue
                parts = [p.strip(' ,') for p in SEP.split(text, maxsplit=1)]
                year = YEAR.search(text)
                out.append({'title': parts[0], 'org': parts[1] if len(parts) > 1 else '', 'year': year.group(0) if year else '', 'text': text})
        return out
    data['awards'] = items('awards')
    data['certifications'] = items('certifications')

    for key in ('summary', 'skills', 'experience', 'projects', 'education', 'awards', 'certifications'):
        if not data.get(key):
            warnings.append(f'No {key} section found; it will be hidden on the site.')
    data['warnings'] = warnings
    return data


def main():
    pdf = pick_pdf()
    out = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else OUT
    data = parse(pdf)
    try:
        data['source'] = pdf.relative_to(ROOT).as_posix()
    except ValueError:
        data['source'] = pdf.name
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

    print(f'Parsed {data["source"]} -> {out}')
    print(f'  {data["name"]} · {data["title"]}')
    for key in ('skills', 'experience', 'projects', 'education', 'awards', 'certifications'):
        print(f'  {key:15} {len(data[key])}')
    for w in data['warnings']:
        print(f'  warning: {w}')


if __name__ == '__main__':
    main()
