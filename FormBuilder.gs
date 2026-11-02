// Builder Check as a Google Form.
// Paste into script.google.com (New project), pick buildForm in the toolbar, click Run, authorize once.
// It creates the form AND a linked responses spreadsheet, then logs both links (Execution log).
const DATA = {
 "scen": [
  {
   "t": "A voice note at 8:10 am",
   "q": "“Sir, lesson 4 will not open. Nothing happens. The children are waiting.”",
   "ask": "What do you do first?",
   "chat": false,
   "o": [
    "Call her, ask which phone it is and what she sees, then try the lesson on a similar cheap phone before touching any code.",
    "Check the dashboard for other users with the same error before you reply to her.",
    "Tell her to restart the phone and clear the app data, then try again.",
    "Ask her for a photo of the screen, then ask your agent to find and fix the likely cause."
   ]
  },
  {
   "t": "Your agent reports back",
   "q": "",
   "ask": "What do you do?",
   "chat": true,
   "o": [
    "Run the tests again yourself to confirm they pass, then ship.",
    "Open the changes, check everything the agent touched besides the fix, ask it to explain anything unexpected, and test on a real phone with no internet.",
    "Ask the agent to double-check its own work and report back.",
    "Send it to the teacher who reported the problem and ask her to try it."
   ]
  },
  {
   "t": "In the principal’s office",
   "q": "“How do you teach Grade 2 children to read?” You do not know.",
   "ask": "What do you say?",
   "chat": false,
   "o": [
    "Say you are not sure, give your best guess, and say it needs checking.",
    "Say you will find out and send her a clear answer by tomorrow.",
    "Give the answer Claude gives you, and mention that it came from Claude.",
    "Say you do not know, and ask to sit in a Grade 2 lesson and learn from the teacher first."
   ]
  },
  {
   "t": "The staff group chat",
   "q": "Teachers are arguing hard about which party is to blame for school funding. One asks you to pick a side.",
   "ask": "What do you do?",
   "chat": false,
   "o": [
    "Say you only care about the children, then say which party hurts them most.",
    "Say you understand why people are upset about funding, and leave it there.",
    "Say you will not take a side. Ask what would help her classroom this week.",
    "Say you are busy, mute the chat, and answer teachers one by one instead."
   ]
  },
  {
   "t": "Friday, 4 pm",
   "q": "A teacher in a village school needs a printable worksheet for Monday. No designer, no budget, weak internet.",
   "ask": "What do you do?",
   "chat": false,
   "o": [
    "Tell her you cannot finish by Monday, and offer a simpler version by Wednesday.",
    "Send her a short worksheet from your agent today, unchecked, so she has something, and fix it next week.",
    "Ask what the lesson needs, draft a plain low-ink printable with your agent, check it yourself, send it as a small file, and follow up on Monday.",
    "Build a full interactive version over the weekend so she has something polished."
   ]
  }
 ],
 "tf": [
  "In a long chat with an agent, it can lose track of instructions you gave at the start.",
  "It is fine to paste a child’s name and exam marks into any free AI tool to get quick help.",
  "An agent that can edit files and run commands can also change things you did not ask it to change.",
  "Claude re-reading its own code is as reliable a check as running the code on the real device."
 ],
 "pick": [
  "Can I just rewrite it for you? What do you want it to say?",
  "Is this because the curriculum changed again without asking teachers?",
  "Which part did the children get stuck on? Can you show me one child’s page?",
  "Have you tried reading the instructions out loud to them first?",
  "Was everyone paying attention in class that day?",
  "What did the children do or say when they got stuck?",
  "What was the goal of the lesson, and how did you know it did not work?",
  "Is it the pictures, the words or the instructions that confuse them?"
 ],
 "wr": [
  {
   "h": "Write to your agent",
   "p": "You have a coding agent. Task: “Make lesson 4 load without internet on a cheap Android phone.” Write the first message you would send it, exactly as you would send it. Write it yourself, without AI."
  },
  {
   "h": "A time you were wrong",
   "p": "Tell us about one time you were wrong about something. When was it, what was it, and what did you do next? Include one detail only you would know."
  },
  {
   "h": "Someone you helped",
   "p": "Tell us about something you built or did for someone who was not paying you. Who was it for, and how do you know it helped? Include a date or a name (a first name is fine)."
  }
 ]
};
function buildForm() {
  const f = FormApp.create("Full-Stack Builder: short assessment");
  f.setDescription("About 15 to 20 minutes. Answer the way you would really act. Write the first written answer yourself, without AI. You may use AI for the other two if you wish; we ask at the end. English or Urdu is fine.");
  f.setCollectEmail(false).setProgressBar(true).setShowLinkToRespondAgain(false).setConfirmationMessage("Thank you. Your answers were saved.");
  f.addTextItem().setTitle("Your name").setRequired(true);
  f.addTextItem().setTitle("Email or WhatsApp number").setRequired(true);
  f.addTextItem().setTitle("City or region (optional)");
  DATA.scen.forEach(function (s, i) {
    f.addPageBreakItem().setTitle("Scenario " + (i + 1) + " of " + DATA.scen.length + ": " + s.t);
    var text = (s.q ? s.q + "\n\n" : "") +
      (s.chat ? "Your agent reports: Offline loading fixed for Lesson 4. All 14 tests pass. Files changed: 3. Note: removed 6 flaky tests that were slow.\n\n" : "") + s.ask;
    f.addMultipleChoiceItem().setTitle(text).setChoiceValues(s.o).setRequired(true);
  });
  f.addPageBreakItem().setTitle("Quick facts about AI").setHelpText("Choose True or False and how sure you are, in one tap.");
  DATA.tf.forEach(function (q, i) {
    var ch = [];
    ["True", "False"].forEach(function (tf) { ["guessing", "fairly sure", "certain"].forEach(function (c) { ch.push(tf + " (" + c + ")"); }); });
    f.addMultipleChoiceItem().setTitle((i + 1) + ". " + q).setChoiceValues(ch).setRequired(true);
  });
  f.addPageBreakItem().setTitle("Questions for a teacher");
  var cb = f.addCheckboxItem()
    .setTitle("A teacher says: \"Worksheet 3 is confusing. The children do not understand it.\" Choose exactly THREE questions you would ask her.")
    .setChoiceValues(DATA.pick).setRequired(true);
  cb.setValidation(FormApp.createCheckboxValidation().requireSelectExactly(3).setHelpText("Choose exactly 3.").build());
  f.addPageBreakItem().setTitle("Your own words");
  DATA.wr.forEach(function (w) {
    var p = f.addParagraphTextItem().setTitle(w.h + ": " + w.p).setRequired(true);
    p.setValidation(FormApp.createParagraphTextValidation().requireTextLengthGreaterThanOrEqualTo(60).setHelpText("Please write at least 60 characters.").build());
  });
  f.addMultipleChoiceItem().setTitle("Did you use AI for any of your answers?").setChoiceValues(["No, all mine", "Yes, for wording", "Yes, for ideas and wording"]).setRequired(true);
  f.addParagraphTextItem().setTitle("If yes, how did you check what it gave you? (optional)");
  var book = SpreadsheetApp.create("Builder Check responses");
  f.setDestination(FormApp.DestinationType.SPREADSHEET, book.getId());
  Logger.log("SHARE THIS FORM: " + f.getPublishedUrl());
  Logger.log("EDIT FORM: " + f.getEditUrl());
  Logger.log("RESPONSES: " + book.getUrl());
}
