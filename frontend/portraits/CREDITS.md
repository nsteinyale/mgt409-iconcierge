# Image and video credits

All people shown are **fictional and AI-generated**. None is a real person, and the app labels every portrait "AI".
Supplied by Nate Stein on 2026-11-08; originals are kept outside the repo in `media_source/`.

| App file | Source |
|---|---|
| attorney, accountant, investor, housing, benefits, assistant, captain_a–captain_d | `professional-photo-video-sets.zip`: Set 1 and Set 2 portraits (fictional professionals; head-and-shoulders crops, 512 x 512) |
| captain_e, captain_f, captain_g, captain_h | Google Gemini images (`Gemini_Generated_Image_fubcbmfubcbmfubc (6)`, `(7)`, `(10)`, `(5)`), cropped to the face |
| ../media/office_orbit.mp4 and its poster | Google Gemini video (`gemini_generated_video_4cbb6843.mp4`), audio removed, re-encoded to 1280 px. Full-screen background on the sign-in and setup screens |
| ../media/team_meeting.mp4 and its poster | Google Gemini video (`gemini_generated_video_9691fedd.mp4`), audio removed, re-encoded to 1280 px. Plays behind the round table while the team works |
| (not used in the app) | `professional-photo-video-sets-v2.zip` adds a voiced fixed-POV storyboard; its burned-in names differ from the app's team, so `docs/storyboard_script_iconcierge.md` has a matched script for regenerating it |

Crops and video re-encoding were done with PyMuPDF and ffmpeg.
