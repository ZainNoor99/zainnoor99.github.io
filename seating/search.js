const searchInput = document.getElementById("guest-search");
const resultsContainer = document.getElementById("results");

function normalize(value) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");
}

function displayName(name) {
    return name.replace(/\s*\*\*\*\s*$/, "").trim();
}

function renderResults(query) {
    const normalizedQuery = normalize(query);

    if (!normalizedQuery) {
        resultsContainer.innerHTML = "";
        return;
    }

    const matches = guests
        .filter((guest) => normalize(displayName(guest.name)).includes(normalizedQuery))
        .sort((a, b) => {
            const aName = normalize(displayName(a.name));
            const bName = normalize(displayName(b.name));
            const aStarts = aName.startsWith(normalizedQuery);
            const bStarts = bName.startsWith(normalizedQuery);

            if (aStarts !== bStarts) return aStarts ? -1 : 1;
            return aName.localeCompare(bName) || a.table - b.table;
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
                <span class="table-number">Table ${guest.table}</span>
            </li>
        `)
        .join("");

    resultsContainer.innerHTML = `
        <p class="result-count">${countLabel}</p>
        <ul class="result-list">${items}</ul>
    `;
}

function escapeHtml(value) {
    return value.replace(/[&<>'"]/g, (character) => {
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

searchInput.addEventListener("input", (event) => {
    renderResults(event.target.value);
});