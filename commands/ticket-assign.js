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
    .setName("ticket-assign")
    .setDescription("Assign this ticket to a staff member.")
    .addUserOption(option =>
      option
        .setName("staff")
        .setDescription("The staff member to assign.")
        .setRequired(true)
    ),

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
        content: "Only ticket staff can assign tickets.",
        ephemeral: true
      });
    }

    const staff = interaction.options.getMember("staff");

    if (!staff || !staff.roles.cache.has(config.staffRoleId)) {
      return interaction.reply({
        content: "Please select a member with the ticket staff role.",
        ephemeral: true
      });
    }

    const updatedTopic = channel.topic
      .replace(/\s*\|\s*Assigned to: \d+/g, "")
      .trim() + ` | Assigned to: ${staff.id}`;

    try {
      await channel.setTopic(updatedTopic);

      await channel.permissionOverwrites.edit(staff.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("Ticket Assigned")
        .setDescription(`This ticket has been assigned to ${staff}.`)
        .setTimestamp();

      return interaction.reply({
        content: `${staff}`,
        embeds: [embed],
        allowedMentions: { users: [staff.id] }
      });
    } catch (error) {
      console.error("TICKET ASSIGN ERROR:", error);

      return interaction.reply({
        content: "I couldn't assign this ticket. Check Tixora's permissions.",
        ephemeral: true
      });
    }
  }
};
