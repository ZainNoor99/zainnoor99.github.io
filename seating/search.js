const searchInput = document.getElementById("guest-search");
const resultsContainer = document.getElementById("results");

// Google Sheet source of truth.
// Column A = Table Number
// Column B = Guest Name
const SHEET_ID = "1LJMgvrPHu-az1qfi-GrStTSauVNULsO5RHEC2CUTtoo";
const SHEET_NAME = "Seating For Website (CAUTION)";
const SHEET_REFRESH_MS = 60 * 1000;

// Keep the existing bundled list as a fallback if Google is temporarily unreachable.
let guestDirectory = Array.isArray(guests) ? [...guests] : [];

function normalize(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");
}

function displayName(name) {
    return String(name ?? "").replace(/\s*\*\*\*\s*$/, "").trim();
}

function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "'": "&#039;",
            '"': "&quot;"
        };
        return entities[character];
    });
}

function cellValue(cell) {
    if (!cell) return "";
    if (cell.v !== null && cell.v !== undefined) return cell.v;
    if (cell.f !== null && cell.f !== undefined) return cell.f;
    return "";
}

function buildSheetUrl() {
    const query = "select A, B where B is not null";

    return (
        `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
        `?tqx=out:json` +
        `&headers=0` +
        `&sheet=${encodeURIComponent(SHEET_NAME)}` +
        `&range=A:B` +
        `&tq=${encodeURIComponent(query)}` +
        `&_=${Date.now()}`
    );
}

function parseGoogleSheetResponse(text) {
    const match = text.match(
        /google\.visualization\.Query\.setResponse\(([\s\S]*?)\);?\s*$/
    );

    if (!match) {
        throw new Error("Unexpected response from Google Sheets.");
    }

    const payload = JSON.parse(match[1]);

    if (payload.status === "error") {
        const message =
            payload.errors?.map((error) => error.detailed_message || error.message).join(" ") ||
            "Google Sheets returned an error.";
        throw new Error(message);
    }

    const rows = payload.table?.rows || [];

    return rows
        .map((row) => {
            const table = String(cellValue(row.c?.[0])).trim();
            const name = String(cellValue(row.c?.[1])).trim();

            return { name, table };
        })
        .filter((guest) => {
            if (!guest.name || !guest.table) return false;

            // Ignore a header row if the tab contains one.
            const normalizedName = normalize(guest.name);
            const normalizedTable = normalize(guest.table);

            return !(
                normalizedName === "name" &&
                (normalizedTable === "table" || normalizedTable === "table number")
            );
        });
}

async function refreshGuestsFromSheet() {
    try {
        const response = await fetch(buildSheetUrl(), {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`Google Sheets request failed with status ${response.status}.`);
        }

        const text = await response.text();
        const sheetGuests = parseGoogleSheetResponse(text);

        if (sheetGuests.length === 0) {
            throw new Error("The seating tab did not contain any guest rows.");
        }

        guestDirectory = sheetGuests;

        // If someone is already typing when the sheet refreshes,
        // immediately update the visible results.
        if (searchInput.value.trim()) {
            renderResults(searchInput.value);
        }
    } catch (error) {
        // The bundled guest list remains available as an emergency fallback.
        console.warn("Could not refresh seating data from Google Sheets:", error);
    }
}

function renderResults(query) {
    const normalizedQuery = normalize(query);

    if (!normalizedQuery) {
        resultsContainer.innerHTML = "";
        return;
    }

    const matches = guestDirectory
        .filter((guest) => normalize(displayName(guest.name)).includes(normalizedQuery))
        .sort((a, b) => {
            const aName = normalize(displayName(a.name));
            const bName = normalize(displayName(b.name));
            const aStarts = aName.startsWith(normalizedQuery);
            const bStarts = bName.startsWith(normalizedQuery);

            if (aStarts !== bStarts) return aStarts ? -1 : 1;

            const nameComparison = aName.localeCompare(bName);
            if (nameComparison !== 0) return nameComparison;

            return String(a.table).localeCompare(String(b.table), undefined, {
                numeric: true,
                sensitivity: "base"
            });
        });

    if (matches.length === 0) {
        resultsContainer.innerHTML = `
            <p class="empty-state">
                We couldn’t find that name. Try a shorter spelling or another part of your name.
            </p>
        `;
        return;
    }

    const countLabel = matches.length === 1 ? "1 match" : `${matches.length} matches`;
    const items = matches
        .map((guest) => `
            <li class="result-item">
                <span class="guest-name">${escapeHtml(displayName(guest.name))}</span>
                <span class="table-number">Table ${escapeHtml(guest.table)}</span>
            </li>
        `)
        .join("");

    resultsContainer.innerHTML = `
        <p class="result-count">${countLabel}</p>
        <ul class="result-list">${items}</ul>
    `;
}

searchInput.addEventListener("input", (event) => {
    renderResults(event.target.value);
});

// Load the latest seating assignments as soon as the page opens.
refreshGuestsFromSheet();

// Refresh automatically while the page remains open.
window.setInterval(refreshGuestsFromSheet, SHEET_REFRESH_MS);

// Refresh again when a guest returns to the tab after leaving it open.
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        refreshGuestsFromSheet();
    }
});
