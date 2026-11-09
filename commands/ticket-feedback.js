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
    .setName("ticket-feedback")
    .setDescription("Rate your experience with Tixora support.")
    .addIntegerOption(option =>
      option
        .setName("rating")
        .setDescription("How would you rate your support experience?")
        .setRequired(true)
        .addChoices(
          { name: "⭐ 1 - Poor", value: 1 },
          { name: "⭐⭐ 2 - Fair", value: 2 },
          { name: "⭐⭐⭐ 3 - Good", value: 3 },
          { name: "⭐⭐⭐⭐ 4 - Very Good", value: 4 },
          { name: "⭐⭐⭐⭐⭐ 5 - Excellent", value: 5 }
        )
    )
    .addStringOption(option =>
      option
        .setName("comment")
        .setDescription("Optional feedback about your experience.")
        .setMaxLength(500)
        .setRequired(false)
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

    const ownerId = channel.topic?.match(/Ticket owner: (\d+)/)?.[1];

    if (!ownerId) {
      return interaction.reply({
        content: "This command can only be used inside a ticket.",
        ephemeral: true
      });
    }

    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        content: "Only the ticket owner can submit feedback.",
        ephemeral: true
      });
    }

    if (channel.topic.includes("Feedback submitted:")) {
      return interaction.reply({
        content: "You've already submitted feedback for this ticket.",
        ephemeral: true
      });
    }

    const rating = interaction.options.getInteger("rating");
    const comment = interaction.options.getString("comment") || "No comment provided.";

    const logsChannel = interaction.guild.channels.cache.find(
      ch => ch.name === "ticket-logs" && ch.isTextBased()
    );

    if (!logsChannel) {
      return interaction.reply({
        content: "I couldn't find the #ticket-logs channel.",
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle("New Ticket Feedback")
      .addFields(
        { name: "Ticket", value: `${channel}`, inline: true },
        { name: "Submitted By", value: `${interaction.user}`, inline: true },
        { name: "Rating", value: `${"⭐".repeat(rating)} (${rating}/5)` },
        { name: "Comment", value: comment }
      )
      .setFooter({ text: "Tixora Support System" })
      .setTimestamp();

    try {
      await logsChannel.send({ embeds: [embed] });
      await channel.setTopic(
        `${channel.topic} | Feedback submitted: ${rating}/5`
      );

      return interaction.reply({
        content: "Thank you! Your feedback has been sent to the support team.",
        ephemeral: true
      });
    } catch (error) {
      console.error("TICKET FEEDBACK ERROR:", error);

      return interaction.reply({
        content: "I couldn't save your feedback. Please try again later.",
        ephemeral: true
      });
    }
  }
};
