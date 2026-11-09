
const fs = require("node:fs");
const path = require("node:path");

async function loadCommands(client) {
  const commandsPath = path.join(__dirname, "../commands");

  const commandFiles = fs.readdirSync(commandsPath)
    .filter(file => file.endsWith(".js"));

  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));

    if (!command.data || !command.execute) {
      console.log(`Skipped invalid command: ${file}`);
      continue;
    }

    client.commands.set(command.data.name, command);

    console.log(`Loaded command: ${command.data.name}`);
  }

  console.log(`Loaded ${client.commands.size} commands.`);
}

module.exports = { loadCommands };
