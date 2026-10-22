# bharatsingh7.github.io

Portfolio of **Bharat Singh Bhati**. Live: https://bharatsingh7.github.io/

The page content comes from the resume PDF: name, title, summary, skills, experience, projects, education, awards and certifications.

## Updating your resume

1. Put your new resume PDF in `resume/`. Any filename works. Delete the old one, or leave it; when there are several, the most recently committed PDF wins.
2. Commit and push.

On every push to `main`, GitHub Actions (`.github/workflows/pages.yml`) runs `tools/parse_resume.py`. That writes `data/resume.json`, and the workflow then publishes the site. Within a minute or two the site, ARIA's answers and the CV download links all reflect the new PDF.

To preview locally before pushing:

```sh
pip install pdfplumber
python3 tools/parse_resume.py          # prints what it found and warns about missing sections
python3 -m http.server 8080            # open http://localhost:8080
```

The parser understands the usual section headings: Summary/Objective, Skills, Experience, Projects, Education, Achievements/Awards and Certifications. It works with bullets that are text characters as well as bullets drawn as shapes. Any section it can't find is hidden on the site.

Things a PDF can't say live in `data/extras.json`: the hero tagline, per-project taglines and artwork, and whether to show your phone number (hidden by default).

## One-time GitHub setup

- The repo must be public, named `Bharatsingh7.github.io`.
- Go to Settings → Pages → Build and deployment → Source: **GitHub Actions**.

Both Pages and Actions are free for public repos.

## Code map

- `js/content.js`: renders the page from `data/resume.json` and `data/extras.json`
- `js/aria.js`: ARIA's chat; every answer is built from the resume data
- `js/main.js`: nav, scroll reveals, and the animated art on the project cards
- `js/3d/room.js`: the 3D desk scene, choreography, idle behaviour and chat reactions
- `js/3d/robot.js`: ARIA's body, face expressions and emotes
- `js/3d/bolt.js`: Bolt, the desk drone
- `js/3d/props.js`: everything on the desk (cat, duck, cube, robotic arm, laptop and so on)
- `js/3d/cursor-drone.js`: the drone that follows the mouse
- `tools/parse_resume.py`: PDF → `data/resume.json`

There's no build step: three.js loads from jsDelivr through an import map.
