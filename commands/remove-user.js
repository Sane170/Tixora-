const {
  SlashCommandBuilder
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
    .setName("remove-user")
    .setDescription("Remove a member from the current ticket.")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Member to remove from this ticket.")
        .setRequired(true)
    ),

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
        content: "Only ticket staff can remove members.",
        ephemeral: true
      });
    }

    const user = interaction.options.getUser("user");
    const ownerId = channel.topic.match(/Ticket owner: (\d+)/)?.[1];

    if (user.id === ownerId) {
      return interaction.reply({
        content: "You cannot remove the ticket owner.",
        ephemeral: true
      });
    }

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (member?.roles.cache.has(config.staffRoleId)) {
      return interaction.reply({
        content: "You cannot remove a member who has the ticket staff role.",
        ephemeral: true
      });
    }

    try {
      await channel.permissionOverwrites.edit(user.id, {
        ViewChannel: false,
        SendMessages: false,
        ReadMessageHistory: false
      });

      return interaction.reply({
        content: `${user} has been removed from this ticket.`,
        allowedMentions: { users: [user.id] }
      });
    } catch (error) {
      console.error("REMOVE USER ERROR:", error);

      return interaction.reply({
        content: "I couldn't remove that member. Check Tixora's permissions.",
        ephemeral: true
      });
    }
  }
};
