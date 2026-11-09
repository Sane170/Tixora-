
const fs = require("node:fs");
const path = require("node:path");

const DATA_DIR = path.join(__dirname, "../data");

const DATA_FILES = {
    config: "ticket-config.json",
    tickets: "tickets.json",
    counters: "ticket-counters.json",
    feedback: "feedback.json",
    staff: "staff.json"
};

// Load data from a JSON file
async function loadData(name) {
    const filename = DATA_FILES[name];

    if (!filename) {
        throw new Error(`Unknown data file: ${name}`);
    }

    const filePath = path.join(DATA_DIR, filename);

    try {
        const content = await fs.promises.readFile(filePath, "utf8");
        return JSON.parse(content);
    } catch (error) {
        if (error.code === "ENOENT") {
            await fs.promises.mkdir(DATA_DIR, { recursive: true });
            await fs.promises.writeFile(
                filePath,
                JSON.stringify({}, null, 2)
            );
            return {};
        }

        throw error;
    }
}

// Save data to a JSON file
async function saveData(name, data) {
    const filename = DATA_FILES[name];

    if (!filename) {
        throw new Error(`Unknown data file: ${name}`);
    }

    const filePath = path.join(DATA_DIR, filename);
    const tempPath = `${filePath}.tmp`;

    await fs.promises.mkdir(DATA_DIR, { recursive: true });

    await fs.promises.writeFile(
        tempPath,
        JSON.stringify(data, null, 2),
        "utf8"
    );

    await fs.promises.rename(tempPath, filePath);
}

module.exports = {
    loadData,
    saveData
};
