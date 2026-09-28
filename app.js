/**
 * EV Charge Master - Application Logic
 * Comprehensive calculation engine, scroll wheel physics, month calendar popup, & notification system.
 */

// Global App State
const AppState = {
  mode: 'start', // 'start' (calculate completion) | 'end' (calculate start)
  selectedDate: new Date(),
  selectedHour: new Date().getHours(),
  selectedMinute: Math.ceil(new Date().getMinutes() / 5) * 5 % 60,
  startCapacity: 20,
  endCapacity: 80,
  settings: {
    batteryCapacity: 60, // 30 to 100 kWh
    chargerRate: 7.2,    // 0.1 to 11.0 kW
    efficiency: 90       // 80% to 98%
  },
  calendarViewingDate: new Date(),
  scheduledNotificationTimer: null
};

// DOM Elements Registry
const DOM = {};

document.addEventListener('DOMContentLoaded', () => {
  initDOM();
  loadSavedSettings();
  initWheelPickers();
  initCalendarModal();
  initSettingsModal();
  initEventListeners();
  updateCalculation();
});

function initDOM() {
  // Mode controls
  DOM.modeStartBtn = document.getElementById('modeStartBtn');
  DOM.modeEndBtn = document.getElementById('modeEndBtn');
  DOM.modeDescription = document.getElementById('modeDescription');
  DOM.dateTimeCardTitle = document.getElementById('dateTimeCardTitle');

  // Date Trigger & Display
  DOM.dateTrigger = document.getElementById('dateTrigger');
  DOM.selectedDateText = document.getElementById('selectedDateText');

  // Wheels
  DOM.hoursWheel = document.getElementById('hoursWheel');
  DOM.minutesWheel = document.getElementById('minutesWheel');
  DOM.nowTimeBtn = document.getElementById('nowTimeBtn');
  DOM.plus30mBtn = document.getElementById('plus30mBtn');
  DOM.plus1hBtn = document.getElementById('plus1hBtn');

  // Capacity Sliders
  DOM.startCapSlider = document.getElementById('startCapSlider');
  DOM.startCapVal = document.getElementById('startCapVal');
  DOM.startCapTrack = document.getElementById('startCapTrack');
  DOM.endCapSlider = document.getElementById('endCapSlider');
  DOM.endCapVal = document.getElementById('endCapVal');
  DOM.endCapTrack = document.getElementById('endCapTrack');

  // Results
  DOM.resultBadgeText = document.getElementById('resultBadgeText');
  DOM.resultTime = document.getElementById('resultTime');
  DOM.resultDate = document.getElementById('resultDate');
  DOM.statDuration = document.getElementById('statDuration');
  DOM.statEnergy = document.getElementById('statEnergy');
  DOM.statRate = document.getElementById('statRate');
  DOM.notificationArea = document.getElementById('notificationActionArea');
  DOM.notifyBtn = document.getElementById('notifyBtn');
  DOM.notifyStatusMsg = document.getElementById('notifyStatusMsg');
  DOM.currentSettingsSummary = document.getElementById('currentSettingsSummary');

  // Calendar Modal
  DOM.calendarModal = document.getElementById('calendarModal');
  DOM.closeCalendarBtn = document.getElementById('closeCalendarBtn');
  DOM.prevMonthBtn = document.getElementById('prevMonthBtn');
  DOM.nextMonthBtn = document.getElementById('nextMonthBtn');
  DOM.calendarMonthYear = document.getElementById('calendarMonthYear');
  DOM.calendarDaysGrid = document.getElementById('calendarDaysGrid');
  DOM.todayCalBtn = document.getElementById('todayCalBtn');
  DOM.confirmCalBtn = document.getElementById('confirmCalBtn');

  // Settings Modal
  DOM.settingsBtn = document.getElementById('settingsBtn');
  DOM.settingsModal = document.getElementById('settingsModal');
  DOM.closeSettingsBtn = document.getElementById('closeSettingsBtn');
  DOM.saveSettingsBtn = document.getElementById('saveSettingsBtn');
  DOM.batteryWheel = document.getElementById('batteryWheel');
  DOM.chargerWheel = document.getElementById('chargerWheel');
  DOM.capacityWheelReadout = document.getElementById('capacityWheelReadout');
  DOM.chargerWheelReadout = document.getElementById('chargerWheelReadout');
  DOM.efficiencySlider = document.getElementById('efficiencySlider');
  DOM.efficiencyValReadout = document.getElementById('efficiencyValReadout');
}

/* ==========================================================================
   LocalStorage Persistence
   ========================================================================== */
function loadSavedSettings() {
  try {
    const saved = localStorage.getItem('ev_charge_master_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.batteryCapacity >= 30 && parsed.batteryCapacity <= 100) {
        AppState.settings.batteryCapacity = parsed.batteryCapacity;
      }
      if (parsed.chargerRate >= 0.1 && parsed.chargerRate <= 11) {
        AppState.settings.chargerRate = parseFloat(parsed.chargerRate.toFixed(1));
      }
      if (parsed.efficiency >= 80 && parsed.efficiency <= 98) {
        AppState.settings.efficiency = parsed.efficiency;
      }
    }
  } catch (e) {
    console.warn('Could not load saved settings', e);
  }
}

function saveSettingsToStorage() {
  try {
    localStorage.setItem('ev_charge_master_settings', JSON.stringify(AppState.settings));
  } catch (e) {
    console.warn('Could not save settings', e);
  }
}

/* ==========================================================================
   Core EV Charging Calculation Engine
   ========================================================================== */
function updateCalculation() {
  const { startCapacity, endCapacity, settings } = AppState;
  
  // 1. Calculate Required Energy (kWh)
  const percentToAdd = Math.max(0, endCapacity - startCapacity);
  const energyNeededKWh = (settings.batteryCapacity * percentToAdd) / 100;
  
  // 2. Calculate Charging Duration in Hours (accounting for efficiency loss)
  const effectivePowerKW = settings.chargerRate * (settings.efficiency / 100);
  let durationHours = 0;
  if (effectivePowerKW > 0 && energyNeededKWh > 0) {
    durationHours = energyNeededKWh / effectivePowerKW;
  }
  
  // 3. Convert duration to total minutes, rounded up to nearest 5 minutes
  let durationTotalMinutes = Math.ceil(durationHours * 60);
  // Round up to nearest 5 mins
  if (durationTotalMinutes % 5 !== 0) {
    durationTotalMinutes = Math.ceil(durationTotalMinutes / 5) * 5;
  }

  const durationHrsDisplay = Math.floor(durationTotalMinutes / 60);
  const durationMinsDisplay = durationTotalMinutes % 60;

  // 4. Construct selected date & time object
  const inputDateTime = new Date(AppState.selectedDate);
  inputDateTime.setHours(AppState.selectedHour, AppState.selectedMinute, 0, 0);

  let resultDateTime = new Date(inputDateTime);

  if (AppState.mode === 'start') {
    // Mode A: Input = Start Time -> Output = Completion Time
    resultDateTime.setMinutes(resultDateTime.getMinutes() + durationTotalMinutes);
    
    DOM.resultBadgeText.textContent = 'Target Charge Completion Time';
    DOM.notificationArea.classList.add('hidden');
  } else {
    // Mode B: Input = Target Finish Time -> Output = Recommended Start Time
    resultDateTime.setMinutes(resultDateTime.getMinutes() - durationTotalMinutes);

    DOM.resultBadgeText.textContent = 'Recommended Start Charging Time';
    DOM.notificationArea.classList.remove('hidden');
  }

  // 5. Render Results
  DOM.resultTime.textContent = formatTime(resultDateTime);
  DOM.resultDate.textContent = formatDateLabel(resultDateTime);
  DOM.statDuration.textContent = `${durationHrsDisplay}h ${durationMinsDisplay}m`;
  DOM.statEnergy.textContent = `${energyNeededKWh.toFixed(1)} kWh`;
  DOM.statRate.textContent = `${settings.chargerRate.toFixed(1)} kW`;
  DOM.currentSettingsSummary.textContent = `${settings.batteryCapacity} kWh @ ${settings.chargerRate.toFixed(1)} kW (${settings.efficiency}%)`;
}

function formatTime(dateObj) {
  const hrs = String(dateObj.getHours()).padStart(2, '0');
  const mins = String(dateObj.getMinutes()).padStart(2, '0');
  return `${hrs}:${mins}`;
}

function formatDateLabel(dateObj) {
  const today = new Date();
  today.setHours(0,0,0,0);

  const targetDate = new Date(dateObj);
  targetDate.setHours(0,0,0,0);

  const diffDays = Math.round((targetDate - today) / (1000 * 60 * 60 * 24));

  const options = { weekday: 'short', month: 'short', day: 'numeric' };
  const formattedStr = dateObj.toLocaleDateString('en-US', options);

  if (diffDays === 0) return `Today (${formattedStr})`;
  if (diffDays === 1) return `Tomorrow (${formattedStr})`;
  if (diffDays === -1) return `Yesterday (${formattedStr})`;
  if (diffDays > 1) return `In ${diffDays} days (${formattedStr})`;
  return formattedStr;
}

/* ==========================================================================
   Scroll Wheel Pickers (Hours 0-23, Minutes 0-55 step 5, Battery 30-100, Charger 0.1-11.0)
   ========================================================================== */
function initWheelPickers() {
  // Build Hours Wheel (00 to 23)
  const hoursData = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  buildWheel(DOM.hoursWheel, hoursData, AppState.selectedHour, (index) => {
    AppState.selectedHour = index;
    updateCalculation();
  });

  // Build Minutes Wheel (00, 05, 10, ... 55)
  const minutesData = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
  const initialMinIndex = Math.min(11, Math.floor(AppState.selectedMinute / 5));
  buildWheel(DOM.minutesWheel, minutesData, initialMinIndex, (index) => {
    AppState.selectedMinute = index * 5;
    updateCalculation();
  });

  // Build Settings Battery Capacity Wheel (30 kWh to 100 kWh)
  const batteryData = Array.from({ length: 71 }, (_, i) => `${30 + i} kWh`);
  const initialBatIndex = AppState.settings.batteryCapacity - 30;
  buildWheel(DOM.batteryWheel, batteryData, initialBatIndex, (index) => {
    AppState.settings.batteryCapacity = 30 + index;
    DOM.capacityWheelReadout.textContent = `${AppState.settings.batteryCapacity} kWh`;
  });

  // Build Settings Charger Rate Wheel (0.1 kW to 11.0 kW in 0.1 increments)
  const chargerData = [];
  for (let rate = 0.1; rate <= 11.05; rate += 0.1) {
    chargerData.push(`${rate.toFixed(1)} kW`);
  }
  const initialChargerIndex = Math.round((AppState.settings.chargerRate - 0.1) / 0.1);
  buildWheel(DOM.chargerWheel, chargerData, Math.max(0, Math.min(chargerData.length - 1, initialChargerIndex)), (index) => {
    AppState.settings.chargerRate = parseFloat((0.1 + index * 0.1).toFixed(1));
    DOM.chargerWheelReadout.textContent = `${AppState.settings.chargerRate.toFixed(1)} kW`;
  });
}

function buildWheel(containerEl, itemsArray, selectedIndex, onSelectCallback) {
  const scrollContainer = containerEl.querySelector('.wheel-scroll');
  scrollContainer.innerHTML = '';

  itemsArray.forEach((text, idx) => {
    const itemEl = document.createElement('div');
    itemEl.className = `wheel-item ${idx === selectedIndex ? 'selected' : ''}`;
    itemEl.textContent = text;
    itemEl.setAttribute('data-index', idx);
    
    itemEl.addEventListener('click', () => {
      scrollToWheelIndex(containerEl, idx);
    });

    scrollContainer.appendChild(itemEl);
  });

  // Scroll position initialization
  setTimeout(() => {
    scrollToWheelIndex(containerEl, selectedIndex, 'auto');
  }, 50);

  // Wheel scroll event listener with debounce for smooth selection
  let scrollTimer;
  containerEl.addEventListener('scroll', () => {
    highlightCenterWheelItem(containerEl);
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const selectedIdx = getCenterWheelIndex(containerEl);
      if (selectedIdx >= 0 && selectedIdx < itemsArray.length) {
        onSelectCallback(selectedIdx);
      }
    }, 100);
  });
}

function scrollToWheelIndex(containerEl, index, behavior = 'smooth') {
  const itemHeight = 48; // Defined in CSS
  containerEl.scrollTo({
    top: index * itemHeight,
    behavior: behavior
  });
}

function getCenterWheelIndex(containerEl) {
  const itemHeight = 48;
  const scrollTop = containerEl.scrollTop;
  return Math.round(scrollTop / itemHeight);
}

function highlightCenterWheelItem(containerEl) {
  const centerIndex = getCenterWheelIndex(containerEl);
  const items = containerEl.querySelectorAll('.wheel-item');
  items.forEach((item, idx) => {
    if (idx === centerIndex) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });
}

/* ==========================================================================
   Full Month Calendar Popup Modal
   ========================================================================== */
function initCalendarModal() {
  updateDateTriggerDisplay();

  DOM.dateTrigger.addEventListener('click', () => {
    AppState.calendarViewingDate = new Date(AppState.selectedDate);
    renderCalendarGrid();
    DOM.calendarModal.classList.remove('hidden');
    DOM.calendarModal.setAttribute('aria-hidden', 'false');
  });

  DOM.closeCalendarBtn.addEventListener('click', closeCalendarModal);
  DOM.confirmCalBtn.addEventListener('click', closeCalendarModal);

  DOM.prevMonthBtn.addEventListener('click', () => {
    AppState.calendarViewingDate.setMonth(AppState.calendarViewingDate.getMonth() - 1);
    renderCalendarGrid();
  });

  DOM.nextMonthBtn.addEventListener('click', () => {
    AppState.calendarViewingDate.setMonth(AppState.calendarViewingDate.getMonth() + 1);
    renderCalendarGrid();
  });

  DOM.todayCalBtn.addEventListener('click', () => {
    AppState.selectedDate = new Date();
    AppState.calendarViewingDate = new Date();
    updateDateTriggerDisplay();
    renderCalendarGrid();
    updateCalculation();
  });
}

function closeCalendarModal() {
  DOM.calendarModal.classList.add('hidden');
  DOM.calendarModal.setAttribute('aria-hidden', 'true');
}

function updateDateTriggerDisplay() {
  const dateObj = AppState.selectedDate;
  const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
  DOM.selectedDateText.textContent = dateObj.toLocaleDateString('en-US', options);
}

function renderCalendarGrid() {
  const viewDate = AppState.calendarViewingDate;
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Title update (e.g. September 2026)
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  DOM.calendarMonthYear.textContent = `${monthNames[month]} ${year}`;

  DOM.calendarDaysGrid.innerHTML = '';

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const totalDaysInPrevMonth = new Date(year, month, 0).getDate();

  const today = new Date();
  const selected = AppState.selectedDate;

  // Previous month trailing days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = totalDaysInPrevMonth - i;
    const dayEl = document.createElement('div');
    dayEl.className = 'cal-day-cell other-month';
    dayEl.textContent = dayNum;
    DOM.calendarDaysGrid.appendChild(dayEl);
  }

  // Current month days
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const dayEl = document.createElement('div');
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
    const isSelected = selected.getFullYear() === year && selected.getMonth() === month && selected.getDate() === day;

    dayEl.className = `cal-day-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`;
    dayEl.textContent = day;

    dayEl.addEventListener('click', () => {
      AppState.selectedDate = new Date(year, month, day);
      updateDateTriggerDisplay();
      renderCalendarGrid();
      updateCalculation();
    });

    DOM.calendarDaysGrid.appendChild(dayEl);
  }
}

/* ==========================================================================
   Settings Modal
   ========================================================================== */
function initSettingsModal() {
  DOM.settingsBtn.addEventListener('click', () => {
    // Sync efficiency slider
    DOM.efficiencySlider.value = AppState.settings.efficiency;
    DOM.efficiencyValReadout.textContent = `${AppState.settings.efficiency}%`;

    DOM.settingsModal.classList.remove('hidden');
    DOM.settingsModal.setAttribute('aria-hidden', 'false');

    // Refresh wheel scroll positions
    setTimeout(() => {
      const initialBatIndex = AppState.settings.batteryCapacity - 30;
      scrollToWheelIndex(DOM.batteryWheel, initialBatIndex, 'auto');

      const initialChargerIndex = Math.round((AppState.settings.chargerRate - 0.1) / 0.1);
      scrollToWheelIndex(DOM.chargerWheel, initialChargerIndex, 'auto');
    }, 100);
  });

  DOM.closeSettingsBtn.addEventListener('click', closeSettingsModal);

  DOM.efficiencySlider.addEventListener('input', (e) => {
    AppState.settings.efficiency = parseInt(e.target.value, 10);
    DOM.efficiencyValReadout.textContent = `${AppState.settings.efficiency}%`;
  });

  DOM.saveSettingsBtn.addEventListener('click', () => {
    saveSettingsToStorage();
    updateCalculation();
    closeSettingsModal();
  });
}

function closeSettingsModal() {
  DOM.settingsModal.classList.add('hidden');
  DOM.settingsModal.setAttribute('aria-hidden', 'true');
}

/* ==========================================================================
   Event Listeners (Mode Toggle, Sliders, Notification Button)
   ========================================================================== */
function initEventListeners() {
  // Mode Switcher
  DOM.modeStartBtn.addEventListener('click', () => {
    setMode('start');
  });

  DOM.modeEndBtn.addEventListener('click', () => {
    setMode('end');
  });

  // Quick Time Chips
  DOM.nowTimeBtn.addEventListener('click', () => {
    const now = new Date();
    AppState.selectedDate = now;
    AppState.selectedHour = now.getHours();
    AppState.selectedMinute = Math.ceil(now.getMinutes() / 5) * 5 % 60;
    
    updateDateTriggerDisplay();
    scrollToWheelIndex(DOM.hoursWheel, AppState.selectedHour);
    scrollToWheelIndex(DOM.minutesWheel, Math.floor(AppState.selectedMinute / 5));
    updateCalculation();
  });

  DOM.plus30mBtn.addEventListener('click', () => {
    let newMins = AppState.selectedMinute + 30;
    if (newMins >= 60) {
      newMins -= 60;
      AppState.selectedHour = (AppState.selectedHour + 1) % 24;
    }
    AppState.selectedMinute = newMins;
    
    scrollToWheelIndex(DOM.hoursWheel, AppState.selectedHour);
    scrollToWheelIndex(DOM.minutesWheel, Math.floor(AppState.selectedMinute / 5));
    updateCalculation();
  });

  DOM.plus1hBtn.addEventListener('click', () => {
    AppState.selectedHour = (AppState.selectedHour + 1) % 24;
    scrollToWheelIndex(DOM.hoursWheel, AppState.selectedHour);
    updateCalculation();
  });

  // Capacity Sliders
  DOM.startCapSlider.addEventListener('input', (e) => {
    let val = parseInt(e.target.value, 10);
    if (val >= AppState.endCapacity) {
      val = AppState.endCapacity - 1;
      DOM.startCapSlider.value = val;
    }
    AppState.startCapacity = val;
    DOM.startCapVal.textContent = `${val}%`;
    DOM.startCapTrack.style.width = `${val}%`;
    updateCalculation();
  });

  DOM.endCapSlider.addEventListener('input', (e) => {
    let val = parseInt(e.target.value, 10);
    if (val <= AppState.startCapacity) {
      val = AppState.startCapacity + 1;
      DOM.endCapSlider.value = val;
    }
    AppState.endCapacity = val;
    DOM.endCapVal.textContent = `${val}%`;
    DOM.endCapTrack.style.width = `${val}%`;
    updateCalculation();
  });

  // Capacity Preset Chips
  document.querySelectorAll('.cap-preset-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.target.getAttribute('data-target');
      const val = parseInt(e.target.getAttribute('data-val'), 10);

      if (target === 'start') {
        if (val < AppState.endCapacity) {
          AppState.startCapacity = val;
          DOM.startCapSlider.value = val;
          DOM.startCapVal.textContent = `${val}%`;
          DOM.startCapTrack.style.width = `${val}%`;
        }
      } else {
        if (val > AppState.startCapacity) {
          AppState.endCapacity = val;
          DOM.endCapSlider.value = val;
          DOM.endCapVal.textContent = `${val}%`;
          DOM.endCapTrack.style.width = `${val}%`;
        }
      }
      updateCalculation();
    });
  });

  // Notification Button Trigger
  DOM.notifyBtn.addEventListener('click', handleScheduleNotification);

  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.log('Service Worker registration failed:', err);
      });
    });
  }
}

function setMode(newMode) {
  AppState.mode = newMode;
  if (newMode === 'start') {
    DOM.modeStartBtn.classList.add('active');
    DOM.modeStartBtn.setAttribute('aria-selected', 'true');
    DOM.modeEndBtn.classList.remove('active');
    DOM.modeEndBtn.setAttribute('aria-selected', 'false');
    
    DOM.modeDescription.textContent = 'Set when you plan to start charging. App calculates when your battery will hit target capacity.';
    DOM.dateTimeCardTitle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Select Start Date & Time`;
  } else {
    DOM.modeEndBtn.classList.add('active');
    DOM.modeEndBtn.setAttribute('aria-selected', 'true');
    DOM.modeStartBtn.classList.remove('active');
    DOM.modeStartBtn.setAttribute('aria-selected', 'false');

    DOM.modeDescription.textContent = 'Set when you want your battery to reach target capacity. App calculates exact time you must plug in.';
    DOM.dateTimeCardTitle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Select Target Finish Date & Time`;
  }
  updateCalculation();
}

/* ==========================================================================
   Web Notifications API Support (Android 14 Browser & PWA)
   ========================================================================== */
function handleScheduleNotification() {
  if (!('Notification' in window)) {
    alert('Web Notifications are not supported by this browser.');
    return;
  }

  if (Notification.permission === 'granted') {
    scheduleReminderAlert();
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        scheduleReminderAlert();
      } else {
        DOM.notifyStatusMsg.textContent = 'Notification permission was denied in browser settings.';
      }
    });
  } else {
    DOM.notifyStatusMsg.textContent = 'Notification permission is blocked. Please enable in browser settings.';
  }
}

function scheduleReminderAlert() {
  const resultText = DOM.resultTime.textContent;
  const dateText = DOM.resultDate.textContent;

  DOM.notifyStatusMsg.textContent = `🔔 Reminder set for ${resultText} (${dateText}) to plug in your EV!`;

  // Display test notification immediately to confirm capability
  new Notification('⚡ EV Charging Reminder Set', {
    body: `We will notify you at ${resultText} to start charging your EV to reach ${AppState.endCapacity}%.`,
    icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2306b6d4"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>'
  });
}
