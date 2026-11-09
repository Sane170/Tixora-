
const fs = require("node:fs");
const path = require("node:path");

async function loadCommands(client) {
  const commandsPath = path.join(__dirname, "../commands");

  const commandFiles = fs.readdirSync(commandsPath)
    .filter(file => file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    client.commands.set(command.name, command);

    console.log(`Loaded command: ${command.name}`);
  }

  console.log(`Loaded ${client.commands.size} commands.`);
}

module.exports = { loadCommands };
