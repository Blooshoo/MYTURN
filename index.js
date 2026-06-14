import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings, renderExtensionTemplateAsync } from '../../../extensions.js';

const MODULE_NAME = 'myturn';
const TEMPLATE_PATH = 'third-party/MYTURN';

const defaultSettings = Object.freeze({
    enabled: true,
    onlyWhenHidden: false,   // only swap the icon when the tab is not the active one
    autoRevert: false,       // if false, the checkmark stays until you revisit the tab
    doneDuration: 2000,      // when autoRevert is on, how long the checkmark stays (ms)
});

/** @returns {typeof defaultSettings} */
function getSettings() {
    if (!extension_settings[MODULE_NAME]) {
        extension_settings[MODULE_NAME] = structuredClone(defaultSettings);
    }
    // Backfill any newly added settings keys.
    for (const key of Object.keys(defaultSettings)) {
        if (extension_settings[MODULE_NAME][key] === undefined) {
            extension_settings[MODULE_NAME][key] = defaultSettings[key];
        }
    }
    return extension_settings[MODULE_NAME];
}

// ---------------------------------------------------------------------------
// Favicon handling
// ---------------------------------------------------------------------------

let faviconLink = null;
let originalHref = null;
let spinnerTimer = null;
let doneTimer = null;
let spinnerAngle = 0;
let checkmarkShowing = false; // true while the "done" checkmark is on the tab

function getFaviconLink() {
    if (faviconLink && document.head.contains(faviconLink)) {
        return faviconLink;
    }
    faviconLink = document.querySelector("link[rel~='icon']");
    if (!faviconLink) {
        faviconLink = document.createElement('link');
        faviconLink.rel = 'icon';
        document.head.appendChild(faviconLink);
    }
    if (originalHref === null) {
        originalHref = faviconLink.getAttribute('href') || 'favicon.ico';
    }
    return faviconLink;
}

function makeCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    return canvas;
}

/** Draws one frame of the spinner arc at the given angle. */
function drawSpinner(angle) {
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d');
    const cx = 16, cy = 16, r = 12;

    // Faint track.
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(120, 160, 220, 0.25)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Moving arc (about 3/4 of the circle).
    ctx.strokeStyle = '#4ea1ff';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, r, angle, angle + Math.PI * 1.5);
    ctx.stroke();

    return canvas.toDataURL('image/png');
}

/** Draws a green checkmark badge. */
function drawCheck() {
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.arc(16, 16, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(9, 16.5);
    ctx.lineTo(14, 21.5);
    ctx.lineTo(23, 11);
    ctx.stroke();

    return canvas.toDataURL('image/png');
}

function clearTimers() {
    if (spinnerTimer) { clearInterval(spinnerTimer); spinnerTimer = null; }
    if (doneTimer) { clearTimeout(doneTimer); doneTimer = null; }
}

function restoreFavicon() {
    clearTimers();
    checkmarkShowing = false;
    if (originalHref !== null) {
        getFaviconLink().setAttribute('href', originalHref);
    }
}

function startLoading() {
    const settings = getSettings();
    if (!settings.enabled) return;
    if (settings.onlyWhenHidden && !document.hidden) return;

    clearTimers();
    const link = getFaviconLink();
    spinnerAngle = 0;
    link.setAttribute('href', drawSpinner(spinnerAngle));
    spinnerTimer = setInterval(() => {
        spinnerAngle += Math.PI / 8;
        link.setAttribute('href', drawSpinner(spinnerAngle));
    }, 90);
}

function showDone() {
    const settings = getSettings();
    if (!settings.enabled) { restoreFavicon(); return; }

    clearTimers();
    // If the user is already looking at this tab, no need to nag with a checkmark.
    if (!document.hidden) { restoreFavicon(); return; }

    getFaviconLink().setAttribute('href', drawCheck());
    checkmarkShowing = true;

    // By default the checkmark persists until the user revisits the tab
    // (handled by the visibilitychange listener). Only auto-revert on a
    // timer when the user has explicitly opted in.
    if (settings.autoRevert) {
        doneTimer = setTimeout(restoreFavicon, settings.doneDuration);
    }
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------

function onGenerationStarted(_type, _options, dryRun) {
    if (dryRun) return; // dry runs are just token counting, not real generation
    startLoading();
}

function onGenerationEnded() {
    showDone();
}

function onGenerationStopped() {
    restoreFavicon();
}

// Once the user comes back to the tab, the checkmark has done its job.
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && checkmarkShowing) {
        restoreFavicon();
    }
});

// ---------------------------------------------------------------------------
// Settings UI
// ---------------------------------------------------------------------------

async function addSettingsUI() {
    const settings = getSettings();
    const html = await renderExtensionTemplateAsync(TEMPLATE_PATH, 'settings');
    $('#extensions_settings2').append(html);

    const $enabled = $('#tgi_enabled');
    const $onlyHidden = $('#tgi_only_hidden');
    const $autoRevert = $('#tgi_auto_revert');
    const $duration = $('#tgi_done_duration');
    const $durationVal = $('#tgi_done_duration_value');
    const $durationRow = $('#tgi_done_duration_row');

    function syncDurationRow() {
        $durationRow.toggle(settings.autoRevert);
    }

    $enabled.prop('checked', settings.enabled);
    $onlyHidden.prop('checked', settings.onlyWhenHidden);
    $autoRevert.prop('checked', settings.autoRevert);
    $duration.val(settings.doneDuration);
    $durationVal.text(`${(settings.doneDuration / 1000).toFixed(1)}s`);
    syncDurationRow();

    $enabled.on('change', function () {
        settings.enabled = !!$(this).prop('checked');
        if (!settings.enabled) restoreFavicon();
        saveSettingsDebounced();
    });

    $onlyHidden.on('change', function () {
        settings.onlyWhenHidden = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $autoRevert.on('change', function () {
        settings.autoRevert = !!$(this).prop('checked');
        syncDurationRow();
        saveSettingsDebounced();
    });

    $duration.on('input', function () {
        settings.doneDuration = Number($(this).val());
        $durationVal.text(`${(settings.doneDuration / 1000).toFixed(1)}s`);
        saveSettingsDebounced();
    });
}

jQuery(async () => {
    getSettings();
    getFaviconLink(); // capture the original favicon early
    await addSettingsUI();

    eventSource.on(event_types.GENERATION_STARTED, onGenerationStarted);
    eventSource.on(event_types.GENERATION_ENDED, onGenerationEnded);
    eventSource.on(event_types.GENERATION_STOPPED, onGenerationStopped);

    console.log('[MYTURN] loaded');
});
