# Token-cost testing inputs

Copy-paste sample inputs for every tool still marked **E** (estimate) in
[tool-cost-tiers.md](./tool-cost-tiers.md). Run each tool with **Run A** and
**Run B** (two different input sizes — short/typical vs. longer/detailed) so
the measured cost is a range, not a single point, matching the format already
used for the measured ("M") tools in that doc.

No need to record anything manually — every generation is saved as its own row
in `token_usage` (text) / `asset_cost` (images/audio). Once you've run
everything, pull `/account/usage` (or the admin usage pages) and hand the
numbers back for the doc update.

Tick off each box as you complete it.

---

## Small tier

### [ ] Meeting Planner — `/tools/meeting-planner`
**Run A**
- Meeting purpose: `Weekly staff briefing`
- Duration: `30`
- Participants: `All teaching staff`
- Topics to cover: `Upcoming inset day, new fire drill procedure, reminder about parents' evening sign-up`

**Run B**
- Meeting purpose: `Termly pupil progress review meeting`
- Duration: `90`
- Participants: `Year 4 team, SENCO, deputy head`
- Topics to cover: `Review of autumn term data for reading, writing and maths across Year 4; identify pupils below age-related expectations; agree intervention groups for spring term; discuss two EHCP referrals in progress; feedback from parents' evening on pupil wellbeing concerns; plan for upcoming moderation visit`
- ✅ Include icebreaker activity, ✅ Include action items section

---

### [ ] Newsletter Writer — `/tools/newsletter-writer`
**Run A**
- Title: `Oak Class Weekly Update`
- School name: `Elmwood Primary School`
- Tone: `Warm and friendly`
- Sections: 1 section — `This week we learned about the water cycle and started our new PE unit on gymnastics.`

**Run B**
- Title: `Elmwood Primary — Autumn Term Newsletter`
- School name: `Elmwood Primary School`
- Tone: `Inspiring and motivational`
- Sections: 4 sections —
  1. `Headteacher's welcome — reflecting on a strong start to the year and thanking parents for their support with the new drop-off system.`
  2. `Curriculum highlights — Year 3 have been studying the Stone Age, Year 5 are exploring fractions in maths, and Reception have settled in wonderfully.`
  3. `Upcoming events — parents' evening on the 14th, harvest festival assembly, and the Year 6 residential trip meeting.`
  4. `Community news — PTA fundraiser results and a call for volunteers for the winter fair.`

---

### [ ] Assembly Planner — `/tools/assembly-planner`
**Run A**
- Stage: `KS1`
- Length: `15`
- Theme: `Kindness`
- Notes: `Include a short story and a simple discussion question.`

**Run B**
- Stage: `KS2`
- Length: `30`
- Theme: `Resilience and growth mindset`
- Notes: `Should include a real-world example of someone overcoming failure, a short video suggestion, an interactive show-of-hands moment, a class discussion prompt, and a closing reflection tying back to our school values of curiosity, kindness and courage.`

---

### [ ] Performance Management — `/tools/performance-management`
**Run A**
- Curriculum: `2014 National Curriculum`
- Staff member: `Class Teacher, Year 2`
- Responsibilities: `Class teaching, phonics lead`

**Run B**
- Curriculum: `2014 National Curriculum`
- School type: `Two-form entry primary school`
- Staff member: `Assistant Headteacher / Y6 Class Teacher`
- Pay scale: `UPS3 + TLR2a`
- Responsibilities: `Whole-school responsibility for assessment and data, line management of the Year 5/6 phase team, class teaching commitment of 3 days per week, leading on transition to secondary school, and coordinating the school's participation in the local maths hub.`

---

## Medium tier

### [ ] Report Writer — `/tools/report-writer`
**Run A**
- Pupil name: `Amelia Clarke`
- Gender: `Female`
- Word count: `100`
- Include targets: `No`
- Tone: `formal`
- Subject card 1 — Subject: `Maths`, Strengths: `Confident with times tables and mental arithmetic`, Areas for development: `Needs more practice with word problems`

**Run B**
- Pupil name: `Jayden Osei`
- Gender: `Male`
- Word count: `250`
- Include targets: `Yes`
- Tone: `formal but encouraging`
- Subject card 1 — Subject: `English`, Strengths: `Excellent creative writing ideas and vivid vocabulary`, Areas for development: `Punctuation accuracy, especially apostrophes`, Targets: `Use apostrophes correctly for possession in independent writing by end of term`
- Subject card 2 — Subject: `Science`, Strengths: `Strong scientific curiosity and asks thoughtful questions`, Areas for development: `Recording results in a more structured way`, Targets: `Independently complete a results table for a class experiment`

---

### [ ] Lesson Observation Report — `/tools/lesson-observation-report`
**Run A**
- Curriculum: `2014 National Curriculum`, Year group: `Year 3`
- Subject: `Maths`
- Learning objective: `To add two 2-digit numbers using column addition`
- Observation focus: `Questioning`
- Strengths: `Clear modelling on the board, good use of manipulatives`
- Areas for development: `More opportunities for pupil talk`

**Run B**
- Curriculum: `2014 National Curriculum`, Year group: `Year 5`
- Subject: `English`
- Learning objective: `To write a persuasive letter using rhetorical devices`
- Observation focus: `Assessment for learning`
- Strengths: `Excellent modelled writing, strong use of success criteria displayed and referenced throughout, effective mini-plenaries checking understanding, high-quality vocabulary instruction with rhetorical devices explicitly taught and modelled`
- Areas for development: `Differentiation for lower-attaining pupils could be more explicit; pace dropped slightly during independent writing time; more targeted questioning for EAL pupils`
- ✅ Include simple action plan, ✅ Suggest follow-up support

---

### [ ] ECT Report Writer — `/tools/ect-report-writer`
**Run A**
- ECT name: `Sophie Bennett`
- Subject: `Class Teacher, Year 1`
- Strengths: `Warm relationships with pupils, well-organised classroom`
- Areas for development: `Pacing of whole-class teaching`

**Run B**
- ECT name: `Daniel Foster`
- Subject: `Class Teacher, Year 6`
- Strengths: `Strong subject knowledge in maths, effective behaviour management using consistent routines, good use of formative assessment to adapt teaching in the moment, positive relationships with parents`
- Areas for development: `Providing more stretch and challenge for greater-depth pupils, developing questioning techniques to probe deeper understanding, and building confidence in leading whole-staff CPD as part of wider school development`
- ✅ Include Professional Development Plan

---

### [ ] Behaviour Support Plan — `/tools/behaviour-support-plan`
**Run A**
- Curriculum/Year: `2014 National Curriculum`, `Year 4`
- Student name: `Leo`, Gender: `Male`, Class: `4B`
- Description of behaviour: `Frequently leaves seat during independent work`
- Behavioural triggers: `Long periods of quiet independent work`

**Run B**
- Curriculum/Year: `2014 National Curriculum`, `Year 4`
- Student name: `Leo Turner`, Gender: `Male`, Class: `4B`
- Support needs: `Suspected ADHD, awaiting assessment`
- Key staff: `Class teacher, TA, SENCO`
- Description of behaviour: `Frequently leaves seat during independent work, calls out answers without raising hand, occasionally becomes physically restless and disruptive to peers nearby, particularly in the afternoon`
- Behavioural triggers: `Long periods of quiet independent work, transitions between activities, and unstructured time such as the end of lunch break`
- Behavioural patterns and context: `Behaviour escalates most often after lunch and is worse on Mondays and Fridays; rarely occurs during practical or hands-on lessons`
- Student strengths and interests: `Very knowledgeable about space and dinosaurs, enjoys helping younger pupils, strong verbal reasoning skills`
- Student dislikes: `Sitting still for long periods, loud noises, unexpected changes to routine`
- Previous interventions: `Movement breaks trialled with some success; visual timetable introduced this term`

---

### [ ] EYFS Action Plan — `/tools/eyfs-action-plan`
**Run A**
- Curriculum: `Early Years Foundation Stage (EYFS)`
- Objective: `Improve fine motor skills across Reception`

**Run B**
- Curriculum: `Early Years Foundation Stage (EYFS)`
- Objective: `Develop children's early writing skills, including correct pencil grip, letter formation, and the confidence to attempt independent mark-making and simple sentence writing, in preparation for the Year 1 curriculum, with a particular focus on boys and summer-born children who are currently below age-related expectations`

---

### [ ] Phonics Support — `/tools/phonics-support`
**Run A**
- Age: `5`
- Grapheme: `sh`

**Run B**
- Age: `6`
- Grapheme: `igh`

---

### [ ] Pupil Premium Planner — `/tools/pupil-premium-planner`
**Run A**
- Education phase: `Primary`
- Challenges: `Low reading attainment among disadvantaged pupils`

**Run B**
- Education phase: `Secondary`
- Challenges: `Persistent attendance gap between disadvantaged and non-disadvantaged pupils, particularly in Key Stage 4; disadvantaged pupils are significantly underrepresented in higher-tier maths and science sets; limited access to enrichment activities and educational trips due to cost barriers; lower rates of homework completion linked to lack of home study space and resources`

---

### [ ] Model Text Generator — `/tools/model-text-generator`
**Run A**
- Curriculum/Year: `2014 National Curriculum`, `Year 3`
- Write: `A diary entry about a rainy school trip`
- Features to include: `First person, past tense, time connectives`
- Length: `200`

**Run B**
- Curriculum/Year: `2014 National Curriculum`, `Year 6`
- Write: `A persuasive letter to the headteacher arguing for longer lunch breaks`
- Features to include: `Rhetorical questions, emotive language, statistics, a clear counter-argument and rebuttal, formal letter layout`
- Keywords to include: `wellbeing, concentration, fairness`
- Adaptation: `GDS`
- Length: `600`

---

### [ ] Learning Walk Report — `/tools/learning-walk-report`
**Run A**
- Classes visited: `Year 2, Year 3`
- Focus: `Behaviour and Attitudes`
- Observed strengths: `Calm transitions, positive praise used consistently`
- Areas for development: `Low-level chatter during carpet time`

**Run B**
- Classes visited: `Year 1, Year 2, Year 3, Year 4`
- Focus: `Quality of Education`
- Observed strengths: `Strong subject knowledge from all teachers observed, clear learning objectives shared and referred back to, good use of retrieval practice starters in every class, effective use of TAs to support lower-attaining pupils`
- Areas for development: `Inconsistent use of the school's marking policy, some missed opportunities to extend greater-depth pupils, vocabulary instruction less explicit in KS1`
- ✅ Suggest professional recommendations, ✅ Include next steps and timeline

---

### [ ] Homework Generator — `/tools/homework-generator`
**Run A**
- Curriculum/Year: `2014 National Curriculum`, `Year 5`
- Subject: `Maths`
- Learning objective: `To multiply and divide by 10, 100 and 1000`
- Homework type: `Worksheet-style questions`
- Length: `Standard task (20 minutes)`
- Include answers: `Yes`

**Run B**
- Curriculum/Year: `2014 National Curriculum`, `Year 8`
- Subject: `Science`
- Learning objective: `To explain the process of photosynthesis and its importance to life on Earth`
- Question types: Multiple Choice (3), Short Answer (3), Essay/Open-Ended (1)
- Homework type: `Exam-style practice`
- Length: `Extended task (30 minutes)`
- Include answers: `Yes`
- Additional instructions: `Include a mark scheme for the essay question and reference key terms: chlorophyll, glucose, stomata, carbon dioxide.`

---

### [ ] Model Answer Generator — `/tools/model-answer-generator`
**Run A**
- Curriculum/Year: `2014 National Curriculum`, `Year 6`
- Subject: `English`
- Question: `Explain how the writer uses language to create tension in the extract.`
- Total marks: `6`

**Run B**
- Curriculum/Year: `2014 National Curriculum`, `Year 10`
- Subject: `Geography`
- Question: `Evaluate the effectiveness of hard engineering strategies used to manage coastal erosion. Refer to a named example in your answer.`
- Content requirements: `Must reference a real case study, include at least two named hard engineering strategies, and weigh up costs vs. benefits`
- Guidelines: `Use PEEL paragraph structure; mark scheme should award points for evaluation, not just description`
- Total marks: `12`

---

### [ ] Topic Overview — `/tools/topic-overview`
**Run A**
- Curriculum/Year: `2014 National Curriculum`, `Year 4`
- Subject: `History`
- Topic: `The Romans`
- Number of lessons: `4`

**Run B**
- Curriculum/Year: `2014 National Curriculum`, `Year 9`
- Subject: `Science`
- Topic: `Forces and motion`
- Number of lessons: `10`
- Adaptation: `GDS`
- Additional context: `This is the first topic of the new academic year, following on from KS3 introductory physics; should build towards GCSE requirements and include at least two practical investigation lessons.`

---

### [ ] Inspection Prep — `/tools/inspection-prep`
**Run A**
- Inspection body: `Ofsted`
- Inspection focus: `Behaviour and attitudes`

**Run B**
- Inspection body: `Ofsted`
- Inspection focus: `Quality of education, with particular attention to curriculum sequencing and disadvantaged pupil outcomes`
- ✅ Include evidence examples, ✅ Include success criteria, ✅ Include recent policy changes

---

### [ ] Quiz Generator — `/tools/quiz-generator`
**Run A**
- Curriculum/Year: `2014 National Curriculum`, `Year 5`
- Subject: `Maths`
- Topic: `Fractions`
- Number of questions: `5`
- Mode: `Single correct answer`

**Run B**
- Curriculum/Year: `2014 National Curriculum`, `Year 9`
- Subject: `Science`
- Topic: `The periodic table and atomic structure`
- Number of questions: `15`
- Mode: `Multiple correct answers`

---

### [ ] Targeted Intervention — `/tools/targeted-intervention`
**Run A**
- Curriculum/Year: `2014 National Curriculum`, `Year 3`
- Subject: `Maths`
- Attitudinal data: `Pupil shows low confidence and avoids attempting challenging questions`

**Run B**
- Curriculum/Year: `2014 National Curriculum`, `Year 7`
- Subject: `English`
- Attitudinal data: `Pupil is reluctant to read aloud in class and often disengages during silent reading time, though shows enthusiasm for graphic novels`
- Aptitudinal data: `Standardised reading age is approximately 18 months below chronological age; strong verbal comprehension when text is read aloud to them`
- Attainment data: `Currently working at emerging Year 5 standard for reading; writing is closer to age-related expectations`
- Other data: `EAL pupil, English is an additional language spoken at home; attendance is 94%`

---

### [ ] Risk Assessment — `/tools/risk-assessment`
**Run A**
- Activity: `Local park visit`
- Location: `Village green park, 10 minutes' walk from school`
- Resources: `Hi-vis vests, first aid kit`

**Run B**
- Activity: `Residential outdoor and adventurous activities trip including canoeing, high ropes course, and an evening night walk`
- Transport: `Coach hire, three-hour journey each way`
- Location: `Outdoor activity centre in the Lake District, including lakeside and woodland areas`
- Resources: `Buoyancy aids, helmets, harnesses, first aid kits, EpiPens for two pupils with allergies, head torches for the night walk, walkie-talkies for staff`

---

### [ ] Sensory Activities — `/tools/sensory-activities`
**Run A**
- Curriculum/Year: `Early Years Foundation Stage (EYFS)`, `Reception`
- Subject: `EYFS`
- Topic: `Autumn`

**Run B**
- Curriculum/Year: `2014 National Curriculum`, `Year 2`
- Subject: `Science`
- Topic: `Materials and their properties`

---

## Large tier

### [ ] Policy Generator — `/tools/policy-generator`
**Run A**
- Curriculum: `2014 National Curriculum`
- Policy: `Mobile Phone Policy`
- Additional requirements: `Should cover pupils and staff`
- Output type: `Draft policy section structure`

**Run B**
- Curriculum: `2014 National Curriculum`
- Policy: `Safeguarding and Child Protection Policy`
- Additional requirements: `Must reference Keeping Children Safe in Education, include the designated safeguarding lead's responsibilities, cover peer-on-peer abuse, online safety, and the procedure for reporting concerns; should be suitable for a two-form entry primary school`
- Output type: `Draft full policy`

---

### [ ] EYFS Planner — `/tools/eyfs-planner`
**Run A**
- Topic: `Minibeasts`
- Number of weeks: `1`

**Run B**
- Topic: `Traditional tales`
- Number of weeks: `3`
- ✅ Include Book List, ✅ Include Home Learning Ideas, ✅ Include Weekly Overview

---

### [ ] School Improvement Plan — `/tools/school-improvement-plan`
**Run A**
- School type: `Primary`
- Areas to improve: `Raise attainment in writing across KS2`
- Plan timeframe: `1`
- Output format: `Table format (a briefer summary)`

**Run B**
- School type: `Secondary`
- Areas to improve: `Improve outcomes in disadvantaged pupil attainment across all key stages, strengthen middle leadership capacity, raise attendance rates school-wide, and embed a consistent whole-school approach to literacy across the curriculum`
- School context: `A larger-than-average secondary school in an area of high deprivation, coming out of a recent Ofsted inspection judged "Requires Improvement," with a relatively high staff turnover in the last two years`
- Plan timeframe: `3`
- Output format: `Narrative format (a more detailed plan)`

---

### [ ] CPD Slideshow — `/tools/cpd-slideshow`
**Run A**
- Topic: `Effective questioning techniques`
- Number of slides: `4`
- Presentation focus: `Practical application`

**Run B**
- Topic: `Using retrieval practice to improve long-term memory`
- Number of slides: `12`
- Additional focus areas: `Should include the cognitive science behind spaced repetition, practical classroom examples across primary and secondary, and common implementation pitfalls to avoid`
- Presentation focus: `Research and theory`
- Content format: `Text and bullet point summary`
- ✅ Include image suggestions

---

## Slideshow sub-tools (harder to trigger standalone)

These fire as part of using the main Slideshow Generator (`/tools/slideshow`)
rather than having their own form:

- **generate-activity** (editor activity) — after generating a deck, open the
  editor and use "Add activity" on a slide.
- **edit-text** (click-text AI modify) — in the editor, click a text block and
  use the AI rewrite/modify action.
- **Audio · speech (tts-1)** — enable the audio narration option when
  generating a slideshow (already partly covered by the "Audio · script"
  measured row, but the actual `tts-1` speech synthesis cost is still
  unmeasured — check `asset_cost` for a `kind = 'audio'` row, not `token_usage`).

Two full slideshow runs are enough to cover these plus sanity-check the
existing full-deck figures:
1. **Web/Pixabay images**, audio on, YouTube on — topic: `The Water Cycle`, 10 slides.
2. **AI images**, audio on — topic: `The Roman Empire`, 8 slides. (This one is
   the expensive one, ~$0.35–0.85 — don't repeat it more than once or twice.)

While in the editor after either run, also trigger one "Add activity" and one
click-to-edit text change to log `generate-activity` and `edit-text`.

---

## When you're done

Come back and share:
- A screenshot or copy of `/account/usage` (or the admin usage report if you
  have `is_admin`), OR
- Just say "done" and I'll query `token_usage` / `asset_cost` directly (via
  Supabase MCP, if connected) to pull the real numbers myself.

Either way, I'll update `docs/tool-cost-tiers.md` (and the other cost docs)
with the measured figures, flipping each "E" row to "M".
