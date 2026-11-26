# GuíaAs · IEPS 2026

Interactive study guide for Mexico's **Ley del Impuesto Especial sobre Producción y Servicios (LIEPS)** and its regulation (**RLIEPS**), built for exam preparation.

Static site: plain HTML + CSS + JavaScript, no build step, no database. Progress is stored in the browser (`localStorage`).

## Study modes

| Mode | What it does |
|---|---|
| Flashcards | 70 concept cards with a 5-box spaced repetition system |
| Exam-style quiz | 125 case-based questions with "porque…" options, hints and explanations citing the article |
| Fill in the blanks | 51 key sentences with a 3-level hint ladder (idea → first letter → half the word) |
| True / False | 35 trap statements with justification |
| Match | 6 sets: rates, articles, deadlines, percentages, RLIEPS |
| Numeric cases | 13 worked calculations (extra) |
| Mock exam | 30 random questions, timer, graded at the end with error review |
| Error review | Replays every item whose last answer was wrong |

Gamification: XP, levels, answer streaks with combo banners, confetti and Web Audio sound effects (no audio files). Light and dark themes.

## Content sources

- LIEPS, current text (last reform DOF 07-11-2025, quotas updated DOF 22-12-2025).
- Transitional article of the 2025 reform: cigarette quota for 2026 is **$0.8516** (the $1.1584 quota takes effect in 2030).
- RLIEPS (DOF 04-12-2006).

All study content lives in `js/data/`:

```
js/data/meta.js    topics and exam date
js/data/quiz1.js   quiz items, arts. 1–6
js/data/quiz2.js   quiz items, arts. 7–28 + RLIEPS
js/data/study.js   cards, cloze, true/false, match, numeric cases
```

Quiz item shape: `{ t: topicId, art, q, o: [4 options], a: correctIndex, why, hint }`.
Options are shuffled at render time, so `a` can be any index.

## Run locally

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Deploy with Docker

```bash
docker build -t guia-ieps .
docker run -d --name guia-ieps -p 8080:80 --restart unless-stopped guia-ieps
```

Or with Compose: `docker compose up -d --build`.

The image is `nginx:alpine` serving the files on port **80** inside the container, with gzip, long cache for `/assets/` and short cache for JS/CSS.

## Keyboard shortcuts

`1–4` / `a–d` answer · `H` hint · `Enter` continue · `Space` flip card · `←/→` navigate in the mock exam.
