// Game state
const game = {
  points: 0,
  tapMultiplier: 1, // doubles each unlocked organ: heart=1, lungs=2, brain=4
  unlockedOrgans: ['heart'],
  organsHealth: {
    heart: 100,
    lungs: 100,
    brain: 100,
  },
  virusList: [],
  virusIdCounter: 0,
  perks: {
    shield: false,
    antivirus: 0,
    heal: 0,
    rapidTapActive: false,
    rapidTapTimeout: null,
  },
  survivalTime: 0,
  timerInterval: null,
  virusSpawnInterval: null,
  gameRunning: false,
  virusActive: false,
};

// Cost constants
const COSTS = {
  unlockLungs: 100,
  unlockBrain: 500,
  shield: 200,
  antivirus: 150,
  heal: 100,
  rapidTap: 300,
};

const MAX_HEALTH = 100;
const SURVIVAL_GOAL = 5 * 60; // 5 minutes in seconds
const VIRUS_START_TIME = 60; // Start virus infections after 60 seconds

// Elements
const mainMenu = document.getElementById('mainMenu');
const gameScreen = document.getElementById('gameScreen');
const pausePopup = document.getElementById('pausePopup');
const failPopup = document.getElementById('failPopup');
const winPopup = document.getElementById('winPopup');
const failReason = document.getElementById('failReason');
const timerElem = document.getElementById('timer');
const pointsElem = document.getElementById('points');

const unlockLungsBtn = document.getElementById('unlockLungsBtn');
const unlockBrainBtn = document.getElementById('unlockBrainBtn');

const perkShieldBtn = document.getElementById('perkShieldBtn');
const perkAntivirusBtn = document.getElementById('perkAntivirusBtn');
const perkHealBtn = document.getElementById('perkHealBtn');
const perkRapidTapBtn = document.getElementById('perkRapidTapBtn');

const heartOrgan = document.getElementById('heartOrgan');

function init() {
  game.organsHealth = { heart: 100, lungs: 100, brain: 100 };
  game.points = 0;
  game.tapMultiplier = 1;
  game.unlockedOrgans = ['heart'];
  game.virusList = [];
  game.virusIdCounter = 0;
  game.perks = {
    shield: false,
    antivirus: 0,
    heal: 0,
    rapidTapActive: false,
    rapidTapTimeout: null,
  };
  game.survivalTime = 0;
  game.gameRunning = false;
  game.virusActive = false;

  updateOrganUI();
  updatePointsUI();
  updateUnlockButtons();
  updatePerkButtons();
  updateTimerUI();

  document.getElementById('heartOrgan').classList.remove('locked', 'infected');
  document.getElementById('lungsOrgan').classList.add('locked');
  document.getElementById('brainOrgan').classList.add('locked');
}

function updateOrganUI() {
  ['heart', 'lungs', 'brain'].forEach(org => {
    const healthPercent = game.organsHealth[org];
    const healthBar = document.getElementById(org + 'HealthBar');
    const healthText = document.getElementById(org + 'Health');
    const organElement = document.getElementById(org + 'Organ');
    
    healthBar.style.width = healthPercent + '%';
    healthText.textContent = Math.floor(healthPercent);

    if (healthPercent < 30) {
      healthBar.classList.add('danger');
    } else {
      healthBar.classList.remove('danger');
    }

    // Update infected status
    const isInfected = game.virusList.some(v => v.target === org);
    if (isInfected) {
      organElement.classList.add('infected');
    } else {
      organElement.classList.remove('infected');
    }
  });
}

function updatePointsUI() {
  pointsElem.textContent = Math.floor(game.points);
}

function updateUnlockButtons() {
  unlockLungsBtn.disabled = game.unlockedOrgans.includes('lungs') || game.points < COSTS.unlockLungs;
  unlockBrainBtn.disabled = !game.unlockedOrgans.includes('lungs') || game.unlockedOrgans.includes('brain') || game.points < COSTS.unlockBrain;

  unlockLungsBtn.classList.toggle('locked-btn', unlockLungsBtn.disabled);
  unlockBrainBtn.classList.toggle('locked-btn', unlockBrainBtn.disabled);
}

function updatePerkButtons() {
  perkShieldBtn.disabled = game.points < COSTS.shield || game.perks.shield;
  perkAntivirusBtn.disabled = game.points < COSTS.antivirus || game.virusList.length === 0;
  perkHealBtn.disabled = game.points < COSTS.heal || Object.values(game.organsHealth).every(h => h >= MAX_HEALTH);
  perkRapidTapBtn.disabled = game.points < COSTS.rapidTap || game.perks.rapidTapActive;
}

function tapHeart() {
  if (!game.gameRunning) return;
  let tapPoints = game.tapMultiplier;
  if (game.perks.rapidTapActive) tapPoints *= 2;
  game.points += tapPoints;
  updatePointsUI();
  updateUnlockButtons();
  updatePerkButtons();
}

function unlockOrgan(organ) {
  if (organ === 'lungs' && game.points >= COSTS.unlockLungs) {
    game.points -= COSTS.unlockLungs;
    game.unlockedOrgans.push('lungs');
    game.tapMultiplier *= 2;
    document.getElementById('lungsOrgan').classList.remove('locked');
  } else if (organ === 'brain' && game.points >= COSTS.unlockBrain) {
    game.points -= COSTS.unlockBrain;
    game.unlockedOrgans.push('brain');
    game.tapMultiplier *= 2;
    document.getElementById('brainOrgan').classList.remove('locked');
  }
  updatePointsUI();
  updateUnlockButtons();
  updatePerkButtons();
}

function buyPerk(perk) {
  if (!game.gameRunning) return;

  if (perk === 'shield' && game.points >= COSTS.shield && !game.perks.shield) {
    game.points -= COSTS.shield;
    game.perks.shield = true;
    perkShieldBtn.disabled = true;

  } else if (perk === 'antivirus' && game.points >= COSTS.antivirus && game.virusList.length > 0) {
    game.points -= COSTS.antivirus;

    // Group viruses by infected organ
    const infectedOrgans = {};
    for (const virus of game.virusList) {
      if (!infectedOrgans[virus.target]) {
        infectedOrgans[virus.target] = [];
      }
      infectedOrgans[virus.target].push(virus);
    }

    // Identify organs with the lowest health
    let lowestHealth = Infinity;
    let weakestOrgans = [];

    for (const organ in infectedOrgans) {
      const health = game.organsHealth[organ];
      if (health < lowestHealth) {
        lowestHealth = health;
        weakestOrgans = [organ];
      } else if (health === lowestHealth) {
        weakestOrgans.push(organ);
      }
    }

    // Pick a random organ among the weakest
    const targetOrgan = weakestOrgans[Math.floor(Math.random() * weakestOrgans.length)];

    // Remove viruses from that one organ only
    game.virusList = game.virusList.filter(virus => {
      if (virus.target === targetOrgan) {
        clearTimeout(virus.timeout);
        clearInterval(virus.damageInterval);
        return false;
      }
      return true;
    });

    updateOrganUI();
    updatePerkButtons();

  } else if (perk === 'heal' && game.points >= COSTS.heal) {
    game.points -= COSTS.heal;
    ['heart', 'lungs', 'brain'].forEach(org => {
      if (game.unlockedOrgans.includes(org)) {
        game.organsHealth[org] = Math.min(MAX_HEALTH, game.organsHealth[org] + 5); // Heal 5%
      }
    });
    updateOrganUI();

  } else if (perk === 'rapidTap' && game.points >= COSTS.rapidTap && !game.perks.rapidTapActive) {
    game.points -= COSTS.rapidTap;
    game.perks.rapidTapActive = true;
    perkRapidTapBtn.disabled = true;

    if (game.perks.rapidTapTimeout) clearTimeout(game.perks.rapidTapTimeout);
    game.perks.rapidTapTimeout = setTimeout(() => {
      game.perks.rapidTapActive = false;
      updatePerkButtons();
    }, 10000); // 10 seconds
  }

  updatePointsUI();
  updatePerkButtons();
}

function spawnVirus() {
  if (!game.gameRunning || !game.virusActive) return;

  const activeOrgans = game.unlockedOrgans;
  if (activeOrgans.length === 0) return;

  const target = activeOrgans[Math.floor(Math.random() * activeOrgans.length)];
  const virusId = ++game.virusIdCounter;

  const damageInterval = setInterval(() => {
    if (!game.gameRunning) {
      clearInterval(damageInterval);
      return;
    }
    applyVirusDamage(target);
  }, 2000); // Damage every 2 seconds

  const timeout = setTimeout(() => {
    clearInterval(damageInterval);
    game.virusList = game.virusList.filter(v => v.id !== virusId);
    updateOrganUI();
    if (game.virusList.length === 0) {
      updatePerkButtons();
    }
  }, 20000); // Virus lasts for 20 seconds

  game.virusList.push({ id: virusId, target, timeout, damageInterval });
  updateOrganUI();
  updatePerkButtons();
}

function applyVirusDamage(target) {
  let damage = game.perks.shield ? 1 : 2; // Reduced damage when shield is active
  game.organsHealth[target] -= damage;
  if (game.organsHealth[target] <= 0) {
    game.organsHealth[target] = 0;
    endGame(false, `${target.charAt(0).toUpperCase() + target.slice(1)} failed.`);
  }
  updateOrganUI();
}

function startGame() {
  mainMenu.style.display = 'none';
  failPopup.style.display = 'none';
  winPopup.style.display = 'none';
  pausePopup.style.display = 'none';
  gameScreen.style.display = 'flex';
  init();
  game.gameRunning = true;

  game.timerInterval = setInterval(() => {
    game.survivalTime++;
    updateTimerUI();
    
    // Activate viruses after 60 seconds
    if (!game.virusActive && game.survivalTime >= VIRUS_START_TIME) {
      game.virusActive = true;
    }
    
    if (game.survivalTime >= SURVIVAL_GOAL) {
      endGame(true);
    }
  }, 1000);

  game.virusSpawnInterval = setInterval(spawnVirus, 8000); // Spawn every 8 seconds
}

function updateTimerUI() {
  const minutes = Math.floor(game.survivalTime / 60);
  const seconds = game.survivalTime % 60;
  timerElem.textContent = `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function pauseGame() {
  if (!game.gameRunning) return;
  game.gameRunning = false;
  clearInterval(game.timerInterval);
  clearInterval(game.virusSpawnInterval);
  game.virusList.forEach(virus => {
    clearTimeout(virus.timeout);
    clearInterval(virus.damageInterval);
  });
  pausePopup.style.display = 'flex';
}

function resumeGame() {
  pausePopup.style.display = 'none';
  game.gameRunning = true;
  
  game.timerInterval = setInterval(() => {
    game.survivalTime++;
    updateTimerUI();
    
    if (!game.virusActive && game.survivalTime >= VIRUS_START_TIME) {
      game.virusActive = true;
    }
    
    if (game.survivalTime >= SURVIVAL_GOAL) {
      endGame(true);
    }
  }, 1000);

  game.virusSpawnInterval = setInterval(spawnVirus, 8000);
}

function endGame(won, reason = '') {
  game.gameRunning = false;
  clearInterval(game.timerInterval);
  clearInterval(game.virusSpawnInterval);
  if (game.perks.rapidTapTimeout) clearTimeout(game.perks.rapidTapTimeout);
  game.virusList.forEach(virus => {
    clearTimeout(virus.timeout);
    clearInterval(virus.damageInterval);
  });

  if (won) {
    winPopup.style.display = 'flex';
  } else {
    failReason.textContent = reason;
    failPopup.style.display = 'flex';
  }
}

function restartGame() {
  endGame();
  startGame();
}

function backToMenu() {
  endGame();
  gameScreen.style.display = 'none';
  failPopup.style.display = 'none';
  winPopup.style.display = 'none';
  pausePopup.style.display = 'none';
  mainMenu.style.display = 'flex';
}

// Hook up event listeners
window.addEventListener('DOMContentLoaded', () => {
  heartOrgan.addEventListener('click', tapHeart);
  unlockLungsBtn.addEventListener('click', () => unlockOrgan('lungs'));
  unlockBrainBtn.addEventListener('click', () => unlockOrgan('brain'));
  perkShieldBtn.addEventListener('click', () => buyPerk('shield'));
  perkAntivirusBtn.addEventListener('click', () => buyPerk('antivirus'));
  perkHealBtn.addEventListener('click', () => buyPerk('heal'));
  perkRapidTapBtn.addEventListener('click', () => buyPerk('rapidTap'));
});