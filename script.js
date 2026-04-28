let verbsData;
let currentLevel = 1;
let streak = 0;
let levelStreak = 0;
let currentVerb;
let currentSentenceIndex = 0;
let remainingVerbsByLevel = {};
let pendingLevelChange = null;
let sentenceOrder = [];
let finalLevel = 1;
let finalLevelQuestionsCount = 0;
let currentSampleSentence = null;
let currentQuestionLevel = 1;
let finalReviewRecentVerbIds = [];
let finalLevelCelebrationTimeout = null;
let levelChangeBannerTimeout = null;
let questionAnswered = false;

// Final-level review avoids repeating the same recently seen verbs too often.
const FINAL_REVIEW_NO_REPEAT_COUNT = 20;

const speechSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

async function loadVerbs() {
    // Loads the verbs data from verbs.json
    const response = await fetch('verbs.json');
    verbsData = await response.json();
    finalLevel = Math.max(...Object.keys(verbsData.levels).map(Number));
}

function getWeightedFinalLevelPool() {
    // Build a weighted pool of levels, favoring higher levels after the final level opens.
    const levels = Object.keys(verbsData.levels).map(Number).sort((a, b) => a - b);
    const pool = [];

    levels.forEach(level => {
        const weight = Math.max(1, level);
        for (let i = 0; i < weight; i++) {
            pool.push(level);
        }
    });

    return pool;
}

function addFinalReviewHistory(verbId) {
    // Tracks recently used final-review verbs so they do not repeat too quickly.
    finalReviewRecentVerbIds.push(verbId);

    if (finalReviewRecentVerbIds.length > FINAL_REVIEW_NO_REPEAT_COUNT) {
        finalReviewRecentVerbIds.shift();
    }
}

function getWeightedFinalReviewPool(excludedIds = new Set()) {
    // Builds a review pool across all levels, excluding any recently used verb ids.
    const levelWeights = getWeightedFinalLevelPool();
    const pool = [];

    levelWeights.forEach(level => {
        const verbs = verbsData.levels[level.toString()] || [];

        verbs.forEach(verb => {
            if (!excludedIds.has(verb.id)) {
                pool.push({ level, verb });
            }
        });
    });

    return pool;
}

function getFinalReviewVerb() {
    // Picks a final-review verb, falling back to the full pool if every recent item is excluded.
    const recentIds = new Set(finalReviewRecentVerbIds);
    let pool = getWeightedFinalReviewPool(recentIds);

    if (pool.length === 0) {
        pool = getWeightedFinalReviewPool();
    }

    const randomIndex = Math.floor(Math.random() * pool.length);
    return pool[randomIndex];
}

function showFinalLevelCelebration() {
    // Shows the special banner and glow effect when the learner reaches the final level.
    const banner = document.getElementById('final-level-banner');
    const levelDisplay = document.getElementById('level-display');

    banner.classList.remove('show');
    levelDisplay.classList.remove('final-level-glow');

    // Force reflow so the animation can replay each time the user re-enters the final level.
    void banner.offsetWidth;
    void levelDisplay.offsetWidth;

    banner.classList.add('show');
    levelDisplay.classList.add('final-level-glow');

    clearTimeout(finalLevelCelebrationTimeout);
    finalLevelCelebrationTimeout = setTimeout(() => {
        banner.classList.remove('show');
        levelDisplay.classList.remove('final-level-glow');
    }, 1800);
}

function showLevelChangeBanner(message, type = 'level-up') {
    // Displays a short banner for level-ups and level-downs.
    const banner = document.getElementById('level-change-banner');
    banner.textContent = message;
    banner.classList.remove('show', 'level-up', 'level-down');

    void banner.offsetWidth;

    banner.classList.add(type, 'show');

    clearTimeout(levelChangeBannerTimeout);
    levelChangeBannerTimeout = setTimeout(() => {
        banner.classList.remove('show', 'level-up', 'level-down');
    }, 1800);
}

function generateQuestion() {
    // Generates and displays a new quiz question with options
    questionAnswered = false;
    document.getElementById('next-question').textContent = 'Next question';

    if (currentLevel === finalLevel) {
        // Give the learner a few final-level-only questions before mixing in review.
        if (finalLevelQuestionsCount < 3) {
            currentQuestionLevel = finalLevel;
            currentVerb = getRandomVerb(finalLevel);
            finalLevelQuestionsCount++;
        } else {
            // Weighted mixed review with a rolling no-repeat window.
            const finalReviewQuestion = getFinalReviewVerb();
            currentQuestionLevel = finalReviewQuestion.level;
            currentVerb = finalReviewQuestion.verb;
        }

        addFinalReviewHistory(currentVerb.id);
    } else {
        currentQuestionLevel = currentLevel;
        currentVerb = getRandomVerb(currentLevel);
    }

    const greek = currentVerb.lemma;

    document.getElementById('greek-verb').textContent = greek;
    document.getElementById('current-level').textContent = currentLevel === finalLevel ? `${currentLevel} (Final Level!)` : currentLevel;
    document.getElementById('streak').textContent = streak;

    const optionsContainer = document.getElementById('options');
    optionsContainer.innerHTML = '';

    const correctAnswer = currentVerb.english;
    const wrongOptions = getWrongOptions(currentVerb, currentQuestionLevel);

    const allOptions = [correctAnswer, ...wrongOptions].sort(() => 0.5 - Math.random());

    allOptions.forEach(option => {
        const button = document.createElement('button');
        button.className = 'option';
        button.textContent = option;
        button.onclick = () => checkAnswer(option === correctAnswer, option);
        optionsContainer.appendChild(button);
    });

    document.getElementById('question-container').style.display = 'block';
    document.getElementById('feedback').style.display = 'none';
    initSentenceOrder();
}

function getRandomVerb(level) {
    // Selects a random verb from the remaining verbs in the given level
    const remaining = getRemainingVerbs(level);
    const index = Math.floor(Math.random() * remaining.length);
    return remaining.splice(index, 1)[0];
}

function getRemainingVerbs(level) {
    // Each level cycles through its verbs once before the pool refills.
    const key = level.toString();
    if (!remainingVerbsByLevel[key] || remainingVerbsByLevel[key].length === 0) {
        remainingVerbsByLevel[key] = [...verbsData.levels[key]];
    }
    return remainingVerbsByLevel[key];
}

function getWrongOptions(correctVerb, level) {
    // Generates three wrong answer options from the same level
    const levelVerbs = verbsData.levels[level.toString()];
    const wrongVerbs = levelVerbs.filter(v => v.id !== correctVerb.id);
    const shuffled = wrongVerbs.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3).map(v => v.english);
}

function shuffle(array) {
    // Shuffles an array in place using Fisher-Yates algorithm
    let currentIndex = array.length, randomIndex;

    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

function initSentenceOrder() {
    // Initializes a shuffled order for the current verb's sentences
    sentenceOrder = currentVerb.sentences.map((_, index) => index);
    shuffle(sentenceOrder);
}

function getNextSentence() {
    // Returns the next sentence in the shuffled order, reshuffling if needed
    if (sentenceOrder.length === 0) {
        initSentenceOrder();
    }
    return currentVerb.sentences[sentenceOrder.shift()];
}

function checkAnswer(isCorrect, selectedOption) {
    // Processes the user's answer, updates UI and game state
    if (questionAnswered) {
        return;
    }

    questionAnswered = true;

    const feedback = document.getElementById('feedback');
    const result = document.getElementById('result');
    const sentencePrompt = document.getElementById('sentence-prompt');
    const sampleSentence = document.getElementById('sample-sentence');

    // Disable all options
    const options = document.querySelectorAll('.option');
    options.forEach(option => {
        option.disabled = true;
        if (option.textContent === currentVerb.english) {
            option.style.backgroundColor = '#4CAF50'; // Green for correct
            option.style.color = 'white';
        } else if (option.textContent === selectedOption && !isCorrect) {
            option.style.backgroundColor = '#f44336'; // Red for wrong selection
            option.style.color = 'white';
        }
    });

    feedback.style.display = 'block';
    sentencePrompt.style.display = 'none';
    sampleSentence.style.display = 'none';

    if (isCorrect) {
        result.textContent = 'Correct!';
        sentencePrompt.style.display = 'block';
        streak++;
        levelStreak++;
        if (levelStreak >= 3) {
            // Level changes are applied on "Next question" so the user can finish the feedback flow first.
            pendingLevelChange = Math.min(currentLevel + 1, finalLevel);
            if (pendingLevelChange > currentLevel) {
                result.textContent = `Correct! Level up to Level ${pendingLevelChange}!`;
                document.getElementById('next-question').textContent = `Go to Level ${pendingLevelChange}`;
            }
        }
    } else {
        const loweredLevel = Math.max(currentLevel - 1, 1);
        result.textContent = `The correct answer is: ${currentVerb.english}`;
        showSampleSentence();
        streak = 0;
        levelStreak = 0;
        pendingLevelChange = loweredLevel;
        if (loweredLevel < currentLevel) {
            document.getElementById('next-question').textContent = `Back to Level ${loweredLevel}`;
        }
    }
    document.getElementById('streak').textContent = streak;
}

function showSampleSentence() {
    // Displays a sample sentence for the current verb
    const sentenceText = document.getElementById('sentence-text');
    currentSampleSentence = getNextSentence();
    sentenceText.innerHTML = `<strong>${currentSampleSentence.greek}</strong> - ${currentSampleSentence.english}`;
    document.getElementById('sentence-prompt').style.display = 'none';
    document.getElementById('sample-sentence').style.display = 'block';
    updateAudioButtonState();
}

function updateAudioButtonState() {
    // Enables or disables the audio button depending on support and sentence availability.
    const playAudioButton = document.getElementById('play-audio');

    if (!speechSupported) {
        playAudioButton.disabled = true;
        playAudioButton.textContent = 'Audio unavailable';
        return;
    }

    playAudioButton.disabled = !currentSampleSentence;
    playAudioButton.textContent = 'Play audio';
}

function speakGreek(text) {
    // Speaks the current Greek sentence aloud using the browser speech engine.
    if (!speechSupported || !text) {
        return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'el-GR';
    utterance.rate = 0.9;

    window.speechSynthesis.speak(utterance);
}

// Marks sentence practice as complete and reveals a sample sentence.
document.getElementById('said-sentence').onclick = () => {
    document.getElementById('result').textContent = 'Great job! Here\'s a sample sentence:';
    showSampleSentence();
};

// Reveals a sample sentence without requiring the learner to say one first.
document.getElementById('show-example').onclick = () => {
    document.getElementById('result').textContent = 'Here\'s an example:';
    showSampleSentence();
};

function prepareNextQuestion() {
    // Applies any pending level changes, resets the per-level streak on real level transitions, then generates the next question.
    if (speechSupported) {
        window.speechSynthesis.cancel();
    }

    currentSampleSentence = null;

    if (pendingLevelChange !== null) {
        const previousLevel = currentLevel;
        const enteringFinalLevel = pendingLevelChange === finalLevel && currentLevel < finalLevel;

        currentLevel = pendingLevelChange;
        pendingLevelChange = null;

        if (currentLevel !== previousLevel) {
            levelStreak = 0;
            if (currentLevel > previousLevel) {
                showLevelChangeBanner(`Level ${currentLevel} unlocked!`, 'level-up');
            } else {
                showLevelChangeBanner(`Back to Level ${currentLevel}`, 'level-down');
            }
        }

        if (enteringFinalLevel) {
            finalLevelQuestionsCount = 0;
            finalReviewRecentVerbIds = [];
            showFinalLevelCelebration();
        } else if (currentLevel !== finalLevel) {
            finalLevelQuestionsCount = 0;
            finalReviewRecentVerbIds = [];
        }
    }
    document.getElementById('current-level').textContent = currentLevel;
    document.getElementById('streak').textContent = streak;
    generateQuestion();
}

const newSentenceButton = document.getElementById('new-sentence');
// Cycles to another sample sentence for the current verb.
newSentenceButton.onclick = () => {
    newSentenceButton.classList.add('animate-click');
    showSampleSentence();
    setTimeout(() => {
        newSentenceButton.classList.remove('animate-click');
    }, 200);
};

// Plays audio for the currently visible sample sentence.
document.getElementById('play-audio').onclick = () => {
    if (currentSampleSentence) {
        speakGreek(currentSampleSentence.greek);
    }
};

// Closes feedback for the current verb and moves the quiz forward.
document.getElementById('next-question').onclick = () => {
    document.getElementById('feedback').style.display = 'none';
    document.getElementById('sentence-prompt').style.display = 'none';
    document.getElementById('sample-sentence').style.display = 'none';
    prepareNextQuestion();
};

// Opens or closes the instructions modal.
document.getElementById('instructions-btn').onclick = () => {
    const instructions = document.getElementById('instructions');
    instructions.classList.toggle('show');
};

// Closes the instructions modal from its close button.
document.getElementById('close-instructions').onclick = () => {
    const instructions = document.getElementById('instructions');
    instructions.classList.remove('show');
};

document.getElementById('instructions').onclick = (e) => {
    // Close when clicking on the backdrop (outside the content box)
    if (e.target.id === 'instructions') {
        e.target.classList.remove('show');
    }
};

// Loads verb data and starts the first question when the page is ready.
window.onload = async () => {
    updateAudioButtonState();
    await loadVerbs();
    generateQuestion();
};
