const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
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
    .setName("ticket-stats")
    .setDescription("View ticket statistics for this server."),

  async execute(interaction) {
    const configs = loadConfigs();
    const config = configs[interaction.guild.id];

    if (!config) {
      return interaction.reply({
        content: "Tixora has not been set up in this server yet.",
        ephemeral: true
      });
    }

    if (!interaction.member.roles.cache.has(config.staffRoleId)) {
      return interaction.reply({
        content: "Only ticket staff can view ticket statistics.",
        ephemeral: true
      });
    }

    const tickets = interaction.guild.channels.cache.filter(channel =>
      channel.isTextBased() &&
      channel.topic?.includes("Ticket owner:")
    );

    const total = tickets.size;

    const archived = tickets.filter(channel =>
      channel.parent?.name === "Closed Tickets"
    ).size;

    const open = total - archived;

    const claimed = tickets.filter(channel =>
      channel.topic?.includes("Claimed by:")
    ).size;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("Tixora Ticket Statistics")
      .setDescription("Ticket activity for this server.")
      .addFields(
        {
          name: "Total Tickets",
          value: `${total}`,
          inline: true
        },
        {
          name: "Open Tickets",
          value: `${open}`,
          inline: true
        },
        {
          name: "Archived Tickets",
          value: `${archived}`,
          inline: true
        },
        {
          name: "Claimed Tickets",
          value: `${claimed}`,
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
