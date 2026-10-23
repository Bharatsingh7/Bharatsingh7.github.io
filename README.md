# bharatsingh7.github.io

My portfolio site → **https://bharatsingh7.github.io/**

I wanted something that felt more like my actual desk than a template, so the top of the page is a little 3D room: too many plants, a window with real sunlight, RGB strips and my name in neon. There's a robot called ARIA who answers questions about my work, a drone called Bolt who runs errands for her (including watering the plants), a robot vacuum with a cactus on it, and a cat who's asleep most of the time. Click things, drag to look around. Most of them do something. It's daytime or night depending on your clock.

## Why the content comes from a PDF

I got tired of updating my resume and then forgetting to update the website. So now the site reads my resume instead. I drop a new PDF in `resume/`, push, and a GitHub Action pulls the text out of it (`tools/parse_resume.py`) and rebuilds the page. Projects, experience, skills, awards and ARIA's answers all come from that one file.

A few things can't come from a resume, like the one-line taglines on project cards. Those live in `data/extras.json`.

If you want to try it locally:

```sh
pip install pdfplumber
python3 tools/parse_resume.py      # tells you what it found in the PDF
python3 -m http.server 8080        # then open localhost:8080
```

## How it's built

Plain HTML, CSS and JavaScript, with three.js for the 3D. There's no framework and no build step, and it's hosted free on GitHub Pages. ARIA doesn't call any AI API. She only knows what's in my resume, and she runs entirely in your browser.

The interesting bits are in `js/3d/`: the room, the robot and her emotes, the drone, the plants and gadgets. It checks how strong your device is and turns things down (shadows, resolution, leaves) on slower phones. Projects at the bottom each get their own animation, picked from what the project is about, so new ones just work.

## Contact

bsbharatsingh52@gmail.com · [LinkedIn](https://linkedin.com/in/bharat-bhati1)
