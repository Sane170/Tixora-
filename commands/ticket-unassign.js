const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");

const configPath = path.join(__dirname, "../data/ticket-config.json");

function loadConfigs() {
  if (!fs.existsSync(configPath)) return {};
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-unassign")
    .setDescription("Remove the assigned staff member from this ticket."),

  async execute(interaction) {
    const channel = interaction.channel;
    const config = loadConfigs()[interaction.guild.id];

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
        content: "Only ticket staff can unassign tickets.",
        ephemeral: true
      });
    }

    const assignedId = channel.topic.match(/Assigned to: (\d+)/)?.[1];

    if (!assignedId) {
      return interaction.reply({
        content: "This ticket isn't assigned to anyone.",
        ephemeral: true
      });
    }

    try {
      const updatedTopic = channel.topic
        .replace(/\s*\|\s*Assigned to: \d+/g, "")
        .trim();

      await channel.setTopic(updatedTopic);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("Ticket Unassigned")
        .setDescription("This ticket is no longer assigned to a specific staff member.")
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error("TICKET UNASSIGN ERROR:", error);

      return interaction.reply({
        content: "I couldn't unassign this ticket. Check Tixora's permissions.",
        ephemeral: true
      });
    }
  }
};
