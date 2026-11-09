const {
  SlashCommandBuilder,
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
    .setName("add-user")
    .setDescription("Add a member to the current ticket.")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Member to add to this ticket.")
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

    const staffRoleId = config.staffRoleId;

    if (!interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.reply({
        content: "Only ticket staff can add members.",
        ephemeral: true
      });
    }

    const user = interaction.options.getUser("user");

    if (user.bot) {
      return interaction.reply({
        content: "You cannot add bots to tickets with this command.",
        ephemeral: true
      });
    }

    const ownerId = channel.topic.match(/Ticket owner: (\d+)/)?.[1];

    if (user.id === ownerId) {
      return interaction.reply({
        content: "That member already owns this ticket.",
        ephemeral: true
      });
    }

    try {
      await channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      });

      return interaction.reply({
        content: `${user} has been added to this ticket.`,
        allowedMentions: { users: [user.id] }
      });
    } catch (error) {
      console.error("ADD USER ERROR:", error);

      return interaction.reply({
        content: "I couldn't add that member. Check Tixora's permissions.",
        ephemeral: true
      });
    }
  }
};
