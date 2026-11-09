
const {
  REST,
  Routes
} = require("discord.js");

const fs = require("node:fs");
const path = require("node:path");

require("dotenv").config();

const commands = [];
const commandsPath = path.join(__dirname, "commands");

async function deployCommands() {
  try {
    if (!process.env.DISCORD_TOKEN) {
      throw new Error("DISCORD_TOKEN is missing.");
    }

    if (!process.env.CLIENT_ID) {
      throw new Error("CLIENT_ID is missing.");
    }

    if (!process.env.GUILD_ID) {
      throw new Error("GUILD_ID is missing.");
    }

    const commandFiles = fs.readdirSync(commandsPath)
      .filter(file => file.endsWith(".js"));

    for (const file of commandFiles) {
      const command = require(path.join(commandsPath, file));

      if (command.data) {
        commands.push(command.data.toJSON());
      }
    }

    const rest = new REST({ version: "10" })
      .setToken(process.env.DISCORD_TOKEN);

    console.log("Registering Tixora commands...");

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log(`Successfully registered ${commands.length} commands!`);

  } catch (error) {
    console.error("COMMAND DEPLOYMENT ERROR:", error);
    process.exitCode = 1;
  }
}

deployCommands();
