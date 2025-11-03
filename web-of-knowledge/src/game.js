import { knowledge as knowledgeSeed } from "./data/knowledge.js";

const MAX_QUESTIONS = 24;
const MAX_GUESSES = 3;
const CONFIDENCE_THRESHOLD = 0.62;

const COMPATIBILITY = {
  yes: { yes: 1.25, no: 0.25, maybe: 0.7, unknown: 0.75 },
  no: { yes: 0.35, no: 1.2, maybe: 0.7, unknown: 0.75 },
  maybe: { yes: 0.85, no: 0.85, maybe: 1.1, unknown: 0.8 }
};

const BASELINE = 0.05;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const ui = {
  question: $("#question"),
  narration: $("#narration"),
  questionCounter: $("#question-counter"),
  guessCounter: $("#guess-counter"),
  buttons: $$(".game__actions .btn"),
  guessArea: $("#guess-area"),
  guessText: $("#guess-text"),
  guessCorrect: $("#guess-correct"),
  guessIncorrect: $("#guess-incorrect"),
  summary: $("#summary"),
  submitButton: $("#submit-session"),
  submitStatus: $("#submit-status"),
  revealForm: $("#reveal-form"),
  newCharacterForm: $("#new-character-form"),
  newQuestionForm: $("#new-question-form"),
  newCharacterAnswers: $("#new-character-answers"),
  newQuestionCharacters: $("#new-question-characters"),
  optionTemplate: $("#option-template")
};

const state = {
  knowledge: null,
  probabilities: new Map(),
  asked: [],
  answers: [],
  questionCount: 0,
  guessCount: 0,
  guessHistory: [],
  gameOver: false,
  correct: null,
  revealedGuess: null
};

async function loadKnowledge() {
  try {
    // Clone the imported seed so the running session can mutate it freely
    // without affecting future sessions or hot-module reloads.
    state.knowledge = JSON.parse(JSON.stringify(knowledgeSeed));
    initialiseProbabilities();
    buildSuggestionForms();
    askNextQuestion();
  } catch (error) {
    console.error(error);
    ui.question.textContent = "The web failed to unspool its knowledge. Refresh to try again.";
    ui.narration.textContent = error.message;
    disableAnswerButtons();
  }
}

function initialiseProbabilities() {
  const characters = state.knowledge.characters;
  const initial = 1 / characters.length;
  characters.forEach((character) => {
    state.probabilities.set(character.id, initial);
  });
}

function buildSuggestionForms() {
  const { questions, characters } = state.knowledge;
  ui.newCharacterAnswers.innerHTML = "";
  ui.newQuestionCharacters.innerHTML = "";

  questions.forEach((question) => {
    const option = ui.optionTemplate.content.cloneNode(true);
    option.querySelector(".field__label").textContent = question.text;
    option.querySelector("select").name = `answer-${question.id}`;
    ui.newCharacterAnswers.appendChild(option);
  });

  characters.forEach((character) => {
    const option = ui.optionTemplate.content.cloneNode(true);
    option.querySelector(".field__label").textContent = character.name;
    option.querySelector("select").name = `character-${character.id}`;
    ui.newQuestionCharacters.appendChild(option);
  });
}

function disableAnswerButtons() {
  ui.buttons.forEach((btn) => {
    btn.disabled = true;
  });
}

function enableAnswerButtons() {
  ui.buttons.forEach((btn) => {
    btn.disabled = false;
  });
}

function nextQuestionCandidate() {
  const { questions } = state.knowledge;
  const unanswered = questions.filter(
    (q) => !state.asked.some((entry) => entry.id === q.id)
  );

  if (!unanswered.length) return null;

  let best = null;
  let bestScore = -Infinity;

  unanswered.forEach((question) => {
    const distribution = { yes: BASELINE, no: BASELINE, maybe: BASELINE, unknown: BASELINE };

    state.knowledge.characters.forEach((character) => {
      const prob = state.probabilities.get(character.id) || BASELINE;
      const answer = character.answers?.[question.id] || "unknown";
      distribution[answer] += prob;
    });

    const total = Object.values(distribution).reduce((acc, value) => acc + value, 0);
    const normalized = Object.values(distribution).map((value) => value / total);
    const entropy = -normalized.reduce((sum, value) => sum + value * Math.log2(value), 0);
    const noise = Math.random() * 0.05;
    const score = entropy + noise;

    if (score > bestScore) {
      bestScore = score;
      best = question;
    }
  });

  return best;
}

function askNextQuestion() {
  if (state.gameOver) return;

  const shouldStop =
    state.questionCount >= MAX_QUESTIONS ||
    state.guessHistory.length >= MAX_GUESSES ||
    topCandidateProbability() >= CONFIDENCE_THRESHOLD;

  if (shouldStop || !hasUnaskedQuestions()) {
    requestGuess();
    return;
  }

  const next = nextQuestionCandidate();
  if (!next) {
    requestGuess();
    return;
  }

  state.currentQuestion = next;
  ui.question.textContent = next.text;
  ui.narration.textContent = "Answer truthfully; every strand matters.";
  updateCounters();
  enableAnswerButtons();
  ui.guessArea.hidden = true;
}

function topCandidateProbability() {
  return Math.max(...state.probabilities.values());
}

function hasUnaskedQuestions() {
  return state.knowledge.questions.length > state.asked.length;
}

function updateCounters() {
  ui.questionCounter.textContent = `Question ${state.questionCount} / ${MAX_QUESTIONS}`;
  const guessesLeft = MAX_GUESSES - state.guessHistory.length;
  ui.guessCounter.textContent = `Guesses left: ${guessesLeft}`;
}

function recordAnswer(answer) {
  if (!state.currentQuestion) return;

  state.questionCount += 1;
  const entry = {
    id: state.currentQuestion.id,
    text: state.currentQuestion.text,
    answer
  };
  state.asked.push(entry);
  state.answers.push(entry);

  applyAnswerToProbabilities(state.currentQuestion.id, answer);
  ui.narration.textContent = narrationForAnswer(answer);
  updateCounters();

  setTimeout(() => {
    askNextQuestion();
  }, 450);
}

function applyAnswerToProbabilities(questionId, answer) {
  let total = 0;
  state.knowledge.characters.forEach((character) => {
    const current = state.probabilities.get(character.id) || BASELINE;
    const expected = character.answers?.[questionId] || "unknown";
    const multiplier = COMPATIBILITY[answer]?.[expected] ?? 1;
    const updated = Math.max(current * multiplier, BASELINE * 0.1);
    state.probabilities.set(character.id, updated);
    total += updated;
  });

  // Renormalise probabilities.
  state.knowledge.characters.forEach((character) => {
    const updated = state.probabilities.get(character.id) || BASELINE;
    state.probabilities.set(character.id, updated / total);
  });
}

function narrationForAnswer(answer) {
  switch (answer) {
    case "yes":
      return "The silken thread pulls taut…";
    case "no":
      return "The web shifts, discarding errant strands.";
    default:
      return "Ambiguity only thickens the web.";
  }
}

function requestGuess() {
  disableAnswerButtons();
  const guess = pickNextGuess();

  if (!guess) {
    concludeGame(null);
    return;
  }

  state.currentGuess = guess;
  ui.guessText.textContent = `The Spider believes you ponder ${guess.name}. Is it correct?`;
  ui.guessArea.hidden = false;
  ui.question.textContent = "";
  ui.narration.textContent = "Answer carefully; the Spider commits this to the Web.";
}

function pickNextGuess() {
  const attemptedIds = new Set(state.guessHistory.map((guess) => guess.character.id));
  const candidates = state.knowledge.characters
    .map((character) => ({
      character,
      probability: state.probabilities.get(character.id) || 0
    }))
    .filter((entry) => !attemptedIds.has(entry.character.id))
    .sort((a, b) => b.probability - a.probability);

  return candidates.length ? candidates[0].character : null;
}

function handleGuessResult(correct) {
  if (!state.currentGuess) return;

  const guessRecord = {
    character: state.currentGuess,
    probability: state.probabilities.get(state.currentGuess.id) || 0,
    correct
  };
  state.guessHistory.push(guessRecord);

  if (correct) {
    concludeGame(state.currentGuess);
  } else {
    state.probabilities.set(state.currentGuess.id, BASELINE * 0.05);
    renormaliseProbabilities();

    if (state.guessHistory.length >= MAX_GUESSES) {
      concludeGame(null);
    } else {
      ui.narration.textContent = "The Spider misses… but we spin anew.";
      state.currentGuess = null;
      setTimeout(() => {
        askNextQuestion();
      }, 600);
    }
  }
}

function renormaliseProbabilities() {
  let total = 0;
  state.knowledge.characters.forEach((character) => {
    const value = state.probabilities.get(character.id) || BASELINE;
    total += value;
  });

  state.knowledge.characters.forEach((character) => {
    const value = state.probabilities.get(character.id) || BASELINE;
    state.probabilities.set(character.id, value / total);
  });
}

function concludeGame(correctCharacter) {
  state.gameOver = true;
  state.correct = Boolean(correctCharacter);
  state.revealedGuess = correctCharacter?.name || null;
  ui.guessArea.hidden = true;
  ui.summary.hidden = false;

  if (correctCharacter) {
    ui.question.textContent = `The web prevailed! ${correctCharacter.name} was captured.`;
    ui.narration.textContent = "Confirm their identity and share new strands if you wish.";
    ui.revealForm.elements.namedItem("revealedName").value = correctCharacter.name;
  } else {
    ui.question.textContent =
      "The Spider could not ensnare the truth. Reveal your character to teach the web.";
    ui.narration.textContent = "Provide their name and any hints so the web remembers.";
  }

  updateCounters();
}

function gatherFormData(form) {
  const data = {};
  new FormData(form).forEach((value, key) => {
    if (value !== "") {
      data[key] = value;
    }
  });
  return data;
}

async function submitSession() {
  const payload = {
    timestamp: new Date().toISOString(),
    asked: state.asked,
    guessHistory: state.guessHistory.map((guess) => ({
      characterId: guess.character.id,
      characterName: guess.character.name,
      probability: guess.probability,
      correct: guess.correct
    })),
    correct: state.correct,
    finalGuess: state.revealedGuess,
    revealed: gatherFormData(ui.revealForm),
    suggestions: {
      newCharacter: gatherFormData(ui.newCharacterForm),
      newQuestion: gatherFormData(ui.newQuestionForm)
    },
    knowledgeSnapshot: {
      questions: state.knowledge.questions.map((q) => ({ id: q.id, text: q.text })),
      characters: state.knowledge.characters.map((c) => ({ id: c.id, name: c.name }))
    }
  };

  ui.submitButton.disabled = true;
  ui.submitStatus.textContent = "Sending strands to the Web of Knowledge…";

  try {
    const res = await fetch("/.netlify/functions/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Failed to submit (${res.status})`);
    }

    ui.submitStatus.textContent = "The Spider thanks you. Your insights are woven into the web.";
  } catch (error) {
    console.error(error);
    ui.submitStatus.textContent =
      "The web shuddered while saving your insights. Please try again in a moment.";
  } finally {
    ui.submitButton.disabled = false;
  }
}

function bindEvents() {
  ui.buttons.forEach((button) => {
    button.addEventListener("click", () => {
      if (!state.currentQuestion) return;
      disableAnswerButtons();
      recordAnswer(button.dataset.answer);
    });
  });

  ui.guessCorrect.addEventListener("click", () => handleGuessResult(true));
  ui.guessIncorrect.addEventListener("click", () => handleGuessResult(false));
  ui.submitButton.addEventListener("click", (event) => {
    event.preventDefault();
    submitSession();
  });
}

bindEvents();
loadKnowledge();
