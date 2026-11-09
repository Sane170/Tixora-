const {
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");

const fs = require("node:fs");
const path = require("node:path");

const configPath = path.join(__dirname, "../data/ticket-config.json");

function loadConfigs() {
  if (!fs.existsSync(configPath)) return {};
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-settings")
    .setDescription("View Tixora's ticket settings for this server."),

  async execute(interaction) {
    const config = loadConfigs()[interaction.guild.id];

    if (!config) {
      return interaction.reply({
        content: "Tixora has not been set up in this server yet.",
        ephemeral: true
      });
    }

    if (!interaction.member.roles.cache.has(config.staffRoleId)) {
      return interaction.reply({
        content: "Only ticket staff can view these settings.",
        ephemeral: true
      });
    }

    const panelChannel = interaction.guild.channels.cache.get(
      config.panelChannelId
    );

    const staffRole = interaction.guild.roles.cache.get(
      config.staffRoleId
    );

    const logsChannel = interaction.guild.channels.cache.find(
      channel => channel.name === "ticket-logs"
    );

    const closedCategory = interaction.guild.channels.cache.find(
      channel =>
        channel.name === "Closed Tickets" &&
        channel.type === 4
    );

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("Tixora Server Settings")
      .setDescription("Current ticket configuration for this server.")
      .addFields(
        {
          name: "Ticket Panel",
          value: panelChannel ? `${panelChannel}` : "Not found",
          inline: true
        },
        {
          name: "Staff Role",
          value: staffRole ? `${staffRole}` : "Not found",
          inline: true
        },
        {
          name: "Ticket Logs",
          value: logsChannel ? `${logsChannel}` : "Not found",
          inline: true
        },
        {
          name: "Closed Tickets Category",
          value: closedCategory ? `${closedCategory}` : "Not found",
          inline: true
        }
      )
      .setFooter({ text: "Tixora Support System" })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
};
