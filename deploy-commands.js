const {
  REST,
  Routes
} = require("discord.js");

const fs = require("node:fs");
const path = require("node:path");

require("dotenv").config();

async function deployCommands() {
  try {
    if (!process.env.DISCORD_TOKEN) {
      throw new Error("DISCORD_TOKEN is missing.");
    }

    if (!process.env.CLIENT_ID) {
      throw new Error("CLIENT_ID is missing.");
    }

    const commands = [];
    const commandsPath = path.join(__dirname, "commands");

    if (!fs.existsSync(commandsPath)) {
      throw new Error("The commands folder could not be found.");
    }

    const commandFiles = fs.readdirSync(commandsPath)
      .filter(file => file.endsWith(".js"));

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);

      delete require.cache[require.resolve(filePath)];

      const command = require(filePath);

      if (!command.data || !command.execute) {
        console.warn(`Skipping invalid command: ${file}`);
        continue;
      }

      commands.push(command.data.toJSON());
    }

    const rest = new REST({ version: "10" })
      .setToken(process.env.DISCORD_TOKEN);

    console.log("--------------------------------");
    console.log("TIXORA GLOBAL COMMAND DEPLOYMENT");
    console.log("--------------------------------");

    console.log(`Found ${commands.length} commands.`);
    console.log("Registering global commands...");

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );

    console.log("--------------------------------");
    console.log("SUCCESS!");
    console.log(`${commands.length} global commands registered.`);
    console.log("Tixora is configured for public servers.");
    console.log("--------------------------------");

    // Remove old guild-specific commands if GUILD_ID is configured.
    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(
          process.env.CLIENT_ID,
          process.env.GUILD_ID
        ),
        { body: [] }
      );

      console.log("Old server-specific commands cleared.");
    }

  } catch (error) {
    console.error("COMMAND DEPLOYMENT ERROR:", error);
    process.exitCode = 1;
  }
}

deployCommands();
