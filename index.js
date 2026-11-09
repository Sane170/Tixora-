
const {
  Client,
  GatewayIntentBits,
  Collection,
  ActivityType
} = require("discord.js");

require("dotenv").config();

const { loadCommands } = require("./handlers/commandHandler");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

client.commands = new Collection();

// Load commands when Tixora starts
async function startBot() {
  try {
    await loadCommands(client);

    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    console.error("TIXORA STARTUP ERROR:", error);
    process.exit(1);
  }
}

// Bot is ready
client.once("ready", () => {
  console.log("--------------------------------");
  console.log(`Tixora is online as ${client.user.tag}`);
  console.log(`Serving ${client.guilds.cache.size} servers`);
  console.log("--------------------------------");

  client.user.setPresence({
    activities: [
      {
        name: "support tickets",
        type: ActivityType.Watching
      }
    ],
    status: "online"
  });
});

// Handle slash commands
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    return interaction.reply({
      content: "That command could not be found.",
      ephemeral: true
    });
  }

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(
      `COMMAND ERROR (${interaction.commandName}):`,
      error
    );

    const response = {
      content: "Tixora encountered an error while running that command.",
      ephemeral: true
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(response).catch(console.error);
    } else {
      await interaction.reply(response).catch(console.error);
    }
  }
});

startBot();
