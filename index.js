
const {
  Client,
  GatewayIntentBits,
  Collection,
  ActivityType,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const fs = require("node:fs");
const path = require("node:path");

require("dotenv").config();

const { loadCommands } = require("./handlers/commandHandler");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();

const configPath = path.join(__dirname, "data", "ticket-config.json");

function getConfigs() {
  if (!fs.existsSync(configPath)) return {};
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

// Load commands and start Tixora
async function startBot() {
  try {
    await loadCommands(client);
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    console.error("TIXORA STARTUP ERROR:", error);
    process.exit(1);
  }
}

// Bot ready
client.once("ready", () => {
  console.log("--------------------------------");
  console.log(`Tixora is online as ${client.user.tag}`);
  console.log(`Serving ${client.guilds.cache.size} servers`);
  console.log("--------------------------------");

  client.user.setPresence({
    activities: [
      {
        name: "support tickets",
        type: ActivityType.Watching
      }
    ],
    status: "online"
  });
});

// Handle commands and ticket interactions
client.on("interactionCreate", async interaction => {

  // Slash commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      return interaction.reply({
        content: "That command could not be found.",
        ephemeral: true
      });
    }

    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error("COMMAND ERROR:", error);

      const response = {
        content: "Tixora encountered an error running that command.",
        ephemeral: true
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(response).catch(console.error);
      } else {
        await interaction.reply(response).catch(console.error);
      }
    }

    return;
  }

  // Ticket category dropdown
  if (
    interaction.isStringSelectMenu() &&
    interaction.customId === "tixora_ticket_category"
  ) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const configs = getConfigs();
      const config = configs[interaction.guild.id];

      if (!config) {
        return interaction.editReply(
          "Tixora hasn't been configured in this server yet. Ask an administrator to run /setup-tickets."
        );
      }

      const staffRole = interaction.guild.roles.cache.get(config.staffRoleId);

      if (!staffRole) {
        return interaction.editReply(
          "The configured staff role no longer exists. Please run /setup-tickets again."
        );
      }

      const existingTicket = interaction.guild.channels.cache.find(channel =>
        channel.type === ChannelType.GuildText &&
        channel.topic?.includes(`Ticket owner: ${interaction.user.id}`)
      );

      if (existingTicket) {
        return interaction.editReply(
          `You already have an open ticket: ${existingTicket}`
        );
      }

      const categories = {
        general: "General Support",
        technical: "Technical Support",
        account: "Account Assistance",
        partnerships: "Partnerships",
        other: "Other Inquiries"
      };

      const selected = interaction.values[0];
      const categoryName = categories[selected];

      if (!categoryName) {
        return interaction.editReply("That ticket category is invalid.");
      }

      const ticketChannel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-")
          .slice(0, 90),
        type: ChannelType.GuildText,
        topic: `Ticket owner: ${interaction.user.id} | Category: ${categoryName}`,
        permissionOverwrites: [
          {
            id: interaction.guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          },
          {
            id: staffRole.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          },
          {
            id: client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageChannels
            ]
          }
        ]
      });

      const ticketEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("Tixora Support Ticket")
        .setDescription(
          `Welcome ${interaction.user}!\n\n` +
          `**Category:** ${categoryName}\n` +
          `**Staff Team:** ${staffRole}\n\n` +
          "Please describe your issue. A staff member will assist you soon."
        )
        .setFooter({ text: "Tixora Support System" })
        .setTimestamp();

      const closeButton = new ButtonBuilder()
        .setCustomId("tixora_close_ticket")
        .setLabel("Close Ticket")
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(closeButton);

      await ticketChannel.send({
        content: `${interaction.user} ${staffRole}`,
        embeds: [ticketEmbed],
        components: [row]
      });

      await interaction.editReply(
        `Your ticket has been created: ${ticketChannel}`
      );

    } catch (error) {
      console.error("TICKET CREATION ERROR:", error);

      await interaction.editReply(
        "Tixora couldn't create your ticket. Please check its server permissions."
      ).catch(console.error);
    }

    return;
  }

  // Close ticket button
  if (
    interaction.isButton() &&
    interaction.customId === "tixora_close_ticket"
  ) {
    const channel = interaction.channel;

    if (
      !channel ||
      !channel.topic ||
      !channel.topic.includes("Ticket owner:")
    ) {
      return interaction.reply({
        content: "This button can only be used inside a Tixora ticket.",
        ephemeral: true
      });
    }

    const configs = getConfigs();
    const config = configs[interaction.guild.id];
    const staffRole = config
      ? interaction.guild.roles.cache.get(config.staffRoleId)
      : null;

    const isOwner = channel.topic.includes(
      `Ticket owner: ${interaction.user.id}`
    );

    const isStaff = staffRole &&
      interaction.member.roles.cache.has(staffRole.id);

    if (!isOwner && !isStaff) {
      return interaction.reply({
        content: "Only the ticket owner or support staff can close this ticket.",
        ephemeral: true
      });
    }

    await interaction.reply({
      content: "This ticket is being closed. This channel will be deleted in 5 seconds."
    });

    setTimeout(() => {
      channel.delete("Ticket closed").catch(console.error);
    }, 5000);
  }
});

startBot();
