# TSGIR Research Cluster site

Static site on GitHub Pages. A GitHub Action (`.github/workflows/fetch-events.yml`)
pulls the public Google Calendar into `events.json` every hour, and `script.js`
renders the month calendar, this quarter's event list, and each event page from it.
Nothing needs to be edited here to add or change an event. Update the Google
Calendar and the site follows within the hour.

## Writing an event in Google Calendar

- **Title** becomes the event name.
- **Location** and **date/time** come from the usual calendar fields.
- **Description** holds the speaker, readings, and any other text. Use these labels,
  one per line:

```
Speaker: Dr. Jane Doe, University of Washington

Readings:
- Simone Browne, Dark Matters (Duke, 2015), chapters 1–2
- Audra Simpson, "On Ethnographic Refuse," Junctures 9 (2007)

About:
Any other text goes here and is shown as the event description.
```

Details:

- `Speaker:` or `Guest speaker:` takes the rest of that line.
- `Readings:` or `Required reading:` starts the reading list. Each following line
  is one reading. Bullets are optional. A blank line ends the list unless the next
  line is also bulleted.
- `About:` or `Description:` switches back to free text. Text before the first label
  is also treated as free text.
- Formatting from the calendar editor (bold, bulleted lists, links) is fine. Links
  survive and are clickable on the event page. Bare URLs are linked automatically.
- If an event has no speaker or no readings, those sections are simply left off.

## Academic terms

The list under the calendar shows upcoming events in the current UW quarter.
Quarter boundaries are approximate month/day cutoffs at the top of `script.js`
(`TERMS`). Adjust them there if a quarter's dates shift.

## Listserv button

The "Join the Listserv" button is temporarily removed. It is commented out in
`index.html` and can be restored by moving the link back out of the comment.
