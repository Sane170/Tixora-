
const {
  Client,
  GatewayIntentBits,
  Collection,
  ActivityType
} = require("discord.js");

require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

client.commands = new Collection();

client.once("ready", () => {
  console.log("--------------------------------");
  console.log(`Tixora is online as ${client.user.tag}`);
  console.log(`Serving ${client.guilds.cache.size} servers`);
  console.log("--------------------------------");

  client.user.setPresence({
    activities: [
      {
        name: "Support made simple | /help",
        type: ActivityType.Watching
      }
    ],
    status: "online"
  });
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(error);

    const response = {
      content: "Something went wrong while running this command.",
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(response);
    } else {
      await interaction.reply(response);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
