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
    .setName("ticket-priority")
    .setDescription("Change the priority of the current ticket.")
    .addStringOption(option =>
      option
        .setName("priority")
        .setDescription("Choose the ticket priority.")
        .setRequired(true)
        .addChoices(
          { name: "Low", value: "Low" },
          { name: "Normal", value: "Normal" },
          { name: "High", value: "High" },
          { name: "Urgent", value: "Urgent" }
        )
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
        content: "Only ticket staff can change ticket priority.",
        ephemeral: true
      });
    }

    const priority = interaction.options.getString("priority");

    const updatedTopic = channel.topic
      .replace(/\s*\|\s*Priority: [^|]*/g, "")
      .trim() + ` | Priority: ${priority}`;

    try {
      await channel.setTopic(updatedTopic);

      const colors = {
        Low: 0x57F287,
        Normal: 0x5865F2,
        High: 0xFEE75C,
        Urgent: 0xED4245
      };

      const embed = new EmbedBuilder()
        .setColor(colors[priority])
        .setTitle("Ticket Priority Updated")
        .setDescription(`This ticket's priority is now **${priority}**.`)
        .setFooter({ text: "Tixora Support System" })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("TICKET PRIORITY ERROR:", error);

      return interaction.reply({
        content: "I couldn't update the priority. Check Tixora's Manage Channels permission.",
        ephemeral: true
      });
    }
  }
};
