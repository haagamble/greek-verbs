let verbsData;
let currentLevel = 1;
let streak = 0;
let currentVerb;
let currentSentenceIndex = 0;
let remainingVerbsByLevel = {};
let pendingLevelChange = null;
let pendingStreakReset = false;
let sentenceOrder = [];
let finalLevel = 1;
let finalLevelQuestionsCount = 0;

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

function generateQuestion() {
    // Generates and displays a new quiz question with options
    if (currentLevel === finalLevel) {
        if (finalLevelQuestionsCount < 3) {
            currentVerb = getRandomVerb(finalLevel);
            finalLevelQuestionsCount++;
        } else {
            // Random level with higher weight for higher levels.
            const levelWeights = getWeightedFinalLevelPool();
            const randomIndex = Math.floor(Math.random() * levelWeights.length);
            const selectedLevel = levelWeights[randomIndex];
            currentVerb = getRandomVerb(selectedLevel);
        }
    } else {
        currentVerb = getRandomVerb(currentLevel);
    }
    const greek = currentVerb.lemma;

     document.getElementById('greek-verb').textContent = greek;
    document.getElementById('current-level').textContent = currentLevel === finalLevel ? `${currentLevel} (Final Level!)` : currentLevel;
    document.getElementById('streak').textContent = streak;

    const optionsContainer = document.getElementById('options');
    optionsContainer.innerHTML = '';

    const correctAnswer = currentVerb.english;
    const wrongOptions = getWrongOptions(currentVerb, currentLevel);

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
            if (pendingLevelChange === finalLevel && currentLevel < finalLevel) {
                pendingStreakReset = true;
            } else {
                pendingStreakReset = (pendingLevelChange < finalLevel);
            }
        }
    } else {
        result.textContent = `The correct answer is: ${currentVerb.english}`;
        showSampleSentence();
        streak = 0;
        pendingLevelChange = Math.max(currentLevel - 1, 1);
        pendingStreakReset = true;
    }
    document.getElementById('streak').textContent = streak;
}

function showSampleSentence() {
    // Displays a sample sentence for the current verb
    const sentenceText = document.getElementById('sentence-text');
    const sentence = getNextSentence();
    sentenceText.innerHTML = `<strong>${sentence.greek}</strong> - ${sentence.english}`;
    document.getElementById('sentence-prompt').style.display = 'none';
    document.getElementById('sample-sentence').style.display = 'block';
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
    if (pendingLevelChange !== null) {
        currentLevel = pendingLevelChange;
        pendingLevelChange = null;
        finalLevelQuestionsCount = 0;
        if (pendingStreakReset) {
            streak = 0;
            pendingStreakReset = false;
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
    await loadVerbs();
    generateQuestion();
};
