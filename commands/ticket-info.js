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
    .setName("ticket-info")
    .setDescription("View information about the current ticket."),

  async execute(interaction) {
    const channel = interaction.channel;
    const configs = loadConfigs();
    const config = configs[interaction.guild.id];

    if (!config) {
      return interaction.reply({
        content: "Tixora has not been set up in this server yet.",
        ephemeral: true
      });
    }

    if (!channel.topic || !channel.topic.includes("Ticket owner:")) {
      return interaction.reply({
        content: "This command can only be used inside a ticket.",
        ephemeral: true
      });
    }

    if (!interaction.member.roles.cache.has(config.staffRoleId)) {
      return interaction.reply({
        content: "Only ticket staff can view ticket information.",
        ephemeral: true
      });
    }

    const ownerId = channel.topic.match(/Ticket owner: (\d+)/)?.[1];
    const category = channel.topic.match(/Category: ([^|]+)/)?.[1]?.trim();
    const claimedBy = channel.topic.match(/Claimed by: (\d+)/)?.[1];

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("Ticket Information")
      .addFields(
        {
          name: "Ticket Owner",
          value: ownerId ? `<@${ownerId}>` : "Unknown",
          inline: true
        },
        {
          name: "Category",
          value: category || "Unknown",
          inline: true
        },
        {
          name: "Assigned Staff",
          value: claimedBy ? `<@${claimedBy}>` : "Unclaimed",
          inline: true
        },
        {
          name: "Ticket Channel",
          value: `${channel}`,
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
