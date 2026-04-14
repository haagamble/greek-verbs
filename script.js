let verbsData;
let currentLevel = 1;
let streak = 0;
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
    finalReviewRecentVerbIds.push(verbId);

    if (finalReviewRecentVerbIds.length > FINAL_REVIEW_NO_REPEAT_COUNT) {
        finalReviewRecentVerbIds.shift();
    }
}

function getWeightedFinalReviewPool(excludedIds = new Set()) {
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
    const recentIds = new Set(finalReviewRecentVerbIds);
    let pool = getWeightedFinalReviewPool(recentIds);

    if (pool.length === 0) {
        pool = getWeightedFinalReviewPool();
    }

    const randomIndex = Math.floor(Math.random() * pool.length);
    return pool[randomIndex];
}

function generateQuestion() {
    // Generates and displays a new quiz question with options
    if (currentLevel === finalLevel) {
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
    // Returns or initializes the list of remaining verbs for a level
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
        if (streak >= 3) {
            pendingLevelChange = Math.min(currentLevel + 1, finalLevel);
        }
    } else {
        result.textContent = `The correct answer is: ${currentVerb.english}`;
        showSampleSentence();
        streak = 0;
        pendingLevelChange = Math.max(currentLevel - 1, 1);
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
    if (!speechSupported || !text) {
        return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'el-GR';
    utterance.rate = 0.9;

    window.speechSynthesis.speak(utterance);
}

document.getElementById('said-sentence').onclick = () => {
    document.getElementById('result').textContent = 'Great job! Here\'s a sample sentence:';
    showSampleSentence();
};

document.getElementById('show-example').onclick = () => {
    document.getElementById('result').textContent = 'Here\'s an example:';
    showSampleSentence();
};

function prepareNextQuestion() {
    // Applies any pending level changes and generates the next question
    if (speechSupported) {
        window.speechSynthesis.cancel();
    }

    currentSampleSentence = null;

    if (pendingLevelChange !== null) {
        const enteringFinalLevel = pendingLevelChange === finalLevel && currentLevel < finalLevel;

        currentLevel = pendingLevelChange;
        pendingLevelChange = null;

        if (enteringFinalLevel) {
            finalLevelQuestionsCount = 0;
            finalReviewRecentVerbIds = [];
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
newSentenceButton.onclick = () => {
    newSentenceButton.classList.add('animate-click');
    showSampleSentence();
    setTimeout(() => {
        newSentenceButton.classList.remove('animate-click');
    }, 200);
};

document.getElementById('play-audio').onclick = () => {
    if (currentSampleSentence) {
        speakGreek(currentSampleSentence.greek);
    }
};

document.getElementById('next-question').onclick = () => {
    document.getElementById('feedback').style.display = 'none';
    document.getElementById('sentence-prompt').style.display = 'none';
    document.getElementById('sample-sentence').style.display = 'none';
    prepareNextQuestion();
};

document.getElementById('instructions-btn').onclick = () => {
    const instructions = document.getElementById('instructions');
    instructions.classList.toggle('show');
};

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

window.onload = async () => {
    updateAudioButtonState();
    await loadVerbs();
    generateQuestion();
};
