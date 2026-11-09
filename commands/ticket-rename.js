const { SlashCommandBuilder } = require("discord.js");

const fs = require("node:fs");
const path = require("node:path");

const configPath = path.join(__dirname, "../data/ticket-config.json");

function loadConfigs() {
  if (!fs.existsSync(configPath)) return {};
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-rename")
    .setDescription("Rename the current ticket channel.")
    .addStringOption(option =>
      option
        .setName("name")
        .setDescription("The new ticket channel name.")
        .setRequired(true)
        .setMaxLength(90)
    ),

  async execute(interaction) {
    const channel = interaction.channel;
    const configs = loadConfigs();
    const config = configs[interaction.guild.id];

    if (!config) {
      return interaction.reply({
        content: "Tixora has not been set up in this server.",
        ephemeral: true
      });
    }

    if (!channel.topic?.includes("Ticket owner:")) {
      return interaction.reply({
        content: "This command can only be used inside a ticket.",
        ephemeral: true
      });
    }

    if (!interaction.member.roles.cache.has(config.staffRoleId)) {
      return interaction.reply({
        content: "Only ticket staff can rename tickets.",
        ephemeral: true
      });
    }

    const newName = interaction.options
      .getString("name")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 90);

    if (!newName) {
      return interaction.reply({
        content: "Please provide a valid channel name.",
        ephemeral: true
      });
    }

    try {
      await channel.setName(newName);

      return interaction.reply({
        content: `Ticket renamed to **${newName}**.`
      });
    } catch (error) {
      console.error("TICKET RENAME ERROR:", error);

      return interaction.reply({
        content: "I couldn't rename this ticket. Check Tixora's Manage Channels permission.",
        ephemeral: true
      });
    }
  }
};
