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
  ButtonStyle,
  AttachmentBuilder
} = require("discord.js");

const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config();

const { loadCommands } = require("./handlers/commandHandler");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

const configPath = path.join(__dirname, "data", "ticket-config.json");

function getConfigs() {
  if (!fs.existsSync(configPath)) return {};
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

async function createTranscript(channel) {
  const messages = [];
  let before;

  while (true) {
    const options = { limit: 100 };
    if (before) options.before = before;

    const batch = await channel.messages.fetch(options);
    if (batch.size === 0) break;

    messages.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }

  messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  const lines = [
    "TIXORA TICKET TRANSCRIPT",
    `Server: ${channel.guild.name}`,
    `Channel: #${channel.name}`,
    `Ticket ID: ${channel.id}`,
    `Created: ${channel.createdAt.toISOString()}`,
    `Transcript generated: ${new Date().toISOString()}`,
    "----------------------------------------",
    ""
  ];

  for (const message of messages) {
    lines.push(
      `[${message.createdAt.toISOString()}] ${message.author.tag} (${message.author.id})`
    );

    if (message.content) lines.push(message.content);
    if (message.embeds.length) lines.push("[Message contains an embed]");

    for (const attachment of message.attachments.values()) {
      lines.push(`[Attachment: ${attachment.name || "File"}]`);
      lines.push(attachment.url);
    }

    if (message.stickers.size) {
      lines.push("[Message contains a sticker]");
    }

    lines.push("");
  }

  return Buffer.from(lines.join("\n"), "utf8");
}

// Ticket buttons
function ticketButtons({ claimed = false, closed = false } = {}) {
  if (closed) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("tixora_reopen_ticket")
        .setLabel("Reopen Ticket")
        .setEmoji("🔓")
        .setStyle(ButtonStyle.Success)
    );
  }

  const claimButton = claimed
    ? new ButtonBuilder()
        .setCustomId("tixora_unclaim_ticket")
        .setLabel("Unclaim Ticket")
        .setEmoji("↩️")
        .setStyle(ButtonStyle.Secondary)
    : new ButtonBuilder()
        .setCustomId("tixora_claim_ticket")
        .setLabel("Claim Ticket")
        .setEmoji("📌")
        .setStyle(ButtonStyle.Primary);

  const closeButton = new ButtonBuilder()
    .setCustomId("tixora_close_ticket")
    .setLabel("Close Ticket")
    .setEmoji("🔒")
    .setStyle(ButtonStyle.Danger);

  return new ActionRowBuilder().addComponents(claimButton, closeButton);
}

// Start bot
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
          "Tixora hasn't been configured. Ask an administrator to run /setup-tickets."
        );
      }

      const staffRole = interaction.guild.roles.cache.get(config.staffRoleId);

      if (!staffRole) {
        return interaction.editReply(
          "The configured staff role no longer exists."
        );
      }

      const existingTicket = interaction.guild.channels.cache.find(channel =>
        channel.type === ChannelType.GuildText &&
        channel.topic?.includes(`Ticket owner: ${interaction.user.id}`)
      );

      if (existingTicket) {
        return interaction.editReply(
          `You already have a ticket: ${existingTicket}`
        );
      }

      const categories = {
        general: "General Support",
        technical: "Technical Support",
        account: "Account Assistance",
        partnerships: "Partnerships",
        other: "Other Inquiries"
      };

      const categoryName = categories[interaction.values[0]];

      if (!categoryName) {
        return interaction.editReply("That ticket category is invalid.");
      }

      const ticketChannel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-")
          .slice(0, 90),

        type: ChannelType.GuildText,

        topic: `Ticket owner: ${interaction.user.id} | Category: ${categoryName} | Original category: none`,

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
        .setFooter({
          text: "Tixora Support System"
        })
        .setTimestamp();

      await ticketChannel.send({
        content: `${interaction.user} ${staffRole}`,
        embeds: [ticketEmbed],
        components: [ticketButtons()]
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

  // Claim ticket button
  if (
    interaction.isButton() &&
    interaction.customId === "tixora_claim_ticket"
  ) {
    try {
      const channel = interaction.channel;

      if (!channel?.topic?.includes("Ticket owner:")) {
        return interaction.reply({
          content: "This is not a valid Tixora ticket.",
          ephemeral: true
        });
      }

      const config = getConfigs()[interaction.guild.id];

      const staffRole = config
        ? interaction.guild.roles.cache.get(config.staffRoleId)
        : null;

      if (!staffRole) {
        return interaction.reply({
          content: "The configured staff role could not be found.",
          ephemeral: true
        });
      }

      const member = await interaction.guild.members.fetch(
        interaction.user.id
      );

      if (!member.roles.cache.has(staffRole.id)) {
        return interaction.reply({
          content: "Only support staff can claim tickets.",
          ephemeral: true
        });
      }

      if (channel.topic.includes("Claimed by:")) {
        return interaction.reply({
          content: "This ticket has already been claimed.",
          ephemeral: true
        });
      }

      await channel.setTopic(
        `${channel.topic} | Claimed by: ${interaction.user.id}`
      );

      await interaction.update({
        components: [ticketButtons({ claimed: true })]
      });

      await channel.send(
        `📌 This ticket has been claimed by ${interaction.user}.`
      );

    } catch (error) {
      console.error("TICKET CLAIM ERROR:", error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Tixora couldn't claim this ticket.",
          ephemeral: true
        }).catch(console.error);
      }
    }

    return;
  }

  // Unclaim ticket button
  if (
    interaction.isButton() &&
    interaction.customId === "tixora_unclaim_ticket"
  ) {
    try {
      const channel = interaction.channel;

      if (!channel?.topic?.includes("Ticket owner:")) {
        return interaction.reply({
          content: "This is not a valid Tixora ticket.",
          ephemeral: true
        });
      }

      const config = getConfigs()[interaction.guild.id];

      const staffRole = config
        ? interaction.guild.roles.cache.get(config.staffRoleId)
        : null;

      if (!staffRole) {
        return interaction.reply({
          content: "The configured staff role could not be found.",
          ephemeral: true
        });
      }

      const member = await interaction.guild.members.fetch(
        interaction.user.id
      );

      if (!member.roles.cache.has(staffRole.id)) {
        return interaction.reply({
          content: "Only support staff can unclaim tickets.",
          ephemeral: true
        });
      }

      const claimedMatch = channel.topic.match(/Claimed by: (\d+)/);

      if (!claimedMatch) {
        return interaction.reply({
          content: "This ticket isn't currently claimed.",
          ephemeral: true
        });
      }

      const updatedTopic = channel.topic
        .replace(/\s*\|\s*Claimed by: \d+/g, "")
        .trim();

      await channel.setTopic(updatedTopic);

      await interaction.update({
        components: [ticketButtons()]
      });

      await channel.send(
        `↩️ This ticket has been unclaimed by ${interaction.user}. It is now available for another staff member.`
      );

    } catch (error) {
      console.error("TICKET UNCLAIM ERROR:", error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Tixora couldn't unclaim this ticket.",
          ephemeral: true
        }).catch(console.error);
      }
    }

    return;
  }

  // Start ticket close confirmation
  if (
    interaction.isButton() &&
    interaction.customId === "tixora_close_ticket"
  ) {
    const channel = interaction.channel;

    if (!channel?.topic?.includes("Ticket owner:")) {
      return interaction.reply({
        content: "This button can only be used inside a Tixora ticket.",
        ephemeral: true
      });
    }

    try {
      const config = getConfigs()[interaction.guild.id];

      const staffRole = config
        ? interaction.guild.roles.cache.get(config.staffRoleId)
        : null;

      const ownerMatch = channel.topic.match(/Ticket owner: (\d+)/);
      const ownerId = ownerMatch ? ownerMatch[1] : null;

      const isOwner = ownerId === interaction.user.id;

      const member = await interaction.guild.members.fetch(
        interaction.user.id
      );

      const isStaff = Boolean(
        staffRole && member.roles.cache.has(staffRole.id)
      );

      if (!isOwner && !isStaff) {
        return interaction.reply({
          content: "Only the ticket owner or support staff can close this ticket.",
          ephemeral: true
        });
      }

      const confirmationRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(
            `tixora_confirm_close:${interaction.message.id}`
          )
          .setLabel("Confirm Close")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId(
            `tixora_cancel_close:${interaction.message.id}`
          )
          .setLabel("Cancel")
          .setEmoji("↩️")
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({
        content: "Are you sure you want to close this ticket? A transcript will be saved and the ticket will be archived.",
        components: [confirmationRow],
        ephemeral: true
      });

    } catch (error) {
      console.error("CLOSE CONFIRMATION ERROR:", error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Tixora couldn't start the close confirmation.",
          ephemeral: true
        }).catch(console.error);
      }
    }

    return;
  }

  // Cancel ticket closure
  if (
    interaction.isButton() &&
    interaction.customId.startsWith("tixora_cancel_close:")
  ) {
    return interaction.update({
      content: "Ticket closure cancelled. Your ticket is still open.",
      components: []
    });
  }

  // Confirm ticket closure
  if (
    interaction.isButton() &&
    interaction.customId.startsWith("tixora_confirm_close:")
  ) {
    const channel = interaction.channel;

    if (!channel?.topic?.includes("Ticket owner:")) {
      return interaction.update({
        content: "This is no longer a valid Tixora ticket.",
        components: []
      });
    }

    try {
      const config = getConfigs()[interaction.guild.id];

      const staffRole = config
        ? interaction.guild.roles.cache.get(config.staffRoleId)
        : null;

      const ownerMatch = channel.topic.match(/Ticket owner: (\d+)/);
      const ownerId = ownerMatch ? ownerMatch[1] : null;

      const isOwner = ownerId === interaction.user.id;

      const member = await interaction.guild.members.fetch(
        interaction.user.id
      );

      const isStaff = Boolean(
        staffRole && member.roles.cache.has(staffRole.id)
      );

      if (!ownerId || (!isOwner && !isStaff)) {
        return interaction.update({
          content: "Only the ticket owner or support staff can confirm closing this ticket.",
          components: []
        });
      }

      const originalMessageId = interaction.customId.split(":")[1];

      if (!originalMessageId) {
        return interaction.update({
          content: "I couldn't find the original ticket controls. The ticket has been kept open.",
          components: []
        });
      }

      const logChannel = interaction.guild.channels.cache.find(ch =>
        ch.name === "ticket-logs" &&
        ch.type === ChannelType.GuildText
      );

      if (!logChannel) {
        return interaction.update({
          content: "I couldn't find #ticket-logs. The ticket has been kept open.",
          components: []
        });
      }

      const closedCategory = interaction.guild.channels.cache.find(ch =>
        ch.name === "Closed Tickets" &&
        ch.type === ChannelType.GuildCategory
      );

      if (!closedCategory) {
        return interaction.update({
          content: "I couldn't find the Closed Tickets category. The ticket has been kept open.",
          components: []
        });
      }

      await interaction.deferUpdate();

      const originalMessage = await channel.messages.fetch(
        originalMessageId
      );

      const transcriptBuffer = await createTranscript(channel);

      const transcriptFile = new AttachmentBuilder(
        transcriptBuffer,
        {
          name: `tixora-${channel.name}-${channel.id}.txt`
        }
      );

      const transcriptEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("Ticket Transcript")
        .setDescription(
          "A ticket has been closed and archived. Its transcript has been saved.\n\n" +
          `**Ticket:** #${channel.name}\n` +
          `**Closed by:** ${interaction.user}\n` +
          `**Ticket ID:** ${channel.id}`
        )
        .setTimestamp();

      await logChannel.send({
        embeds: [transcriptEmbed],
        files: [transcriptFile]
      });

      await channel.permissionOverwrites.edit(ownerId, {
        ViewChannel: true,
        SendMessages: false,
        ReadMessageHistory: true
      });

      await channel.setParent(closedCategory.id);

      await originalMessage.edit({
        components: [ticketButtons({ closed: true })]
      });

      await channel.send(
        `🔒 This ticket has been closed by ${interaction.user} and moved to **Closed Tickets**. Staff can reopen it when needed.`
      );

      await interaction.editReply({
        content: "Ticket successfully closed! The transcript has been saved.",
        components: []
      });

    } catch (error) {
      console.error("TICKET CLOSE/ARCHIVE ERROR:", error);

      const message =
        "Tixora couldn't finish archiving this ticket. Please check its permissions and try again.";

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: message,
          components: []
        }).catch(console.error);
      } else {
        await interaction.reply({
          content: message,
          ephemeral: true
        }).catch(console.error);
      }
    }

    return;
  }

  // Reopen archived ticket (staff only)
  if (
    interaction.isButton() &&
    interaction.customId === "tixora_reopen_ticket"
  ) {
    try {
      const channel = interaction.channel;

      if (!channel?.topic?.includes("Ticket owner:")) {
        return interaction.reply({
          content: "This is not a valid Tixora ticket.",
          ephemeral: true
        });
      }

      const config = getConfigs()[interaction.guild.id];

      const staffRole = config
        ? interaction.guild.roles.cache.get(config.staffRoleId)
        : null;

      if (!staffRole) {
        return interaction.reply({
          content: "The configured staff role could not be found.",
          ephemeral: true
        });
      }

      const member = await interaction.guild.members.fetch(
        interaction.user.id
      );

      if (!member.roles.cache.has(staffRole.id)) {
        return interaction.reply({
          content: "Only support staff can reopen tickets.",
          ephemeral: true
        });
      }

      const ownerMatch = channel.topic.match(/Ticket owner: (\d+)/);
      const ownerId = ownerMatch ? ownerMatch[1] : null;

      if (!ownerId) {
        return interaction.reply({
          content: "I couldn't identify the ticket owner.",
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });

      await channel.permissionOverwrites.edit(ownerId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      });

      // Move the ticket out of Closed Tickets
      await channel.setParent(null);

      const claimedMatch = channel.topic.match(/Claimed by: (\d+)/);
      const claimed = Boolean(claimedMatch);

      await interaction.message.edit({
        components: [ticketButtons({ claimed })]
      });

      await channel.send(
        `🔓 This ticket has been reopened by ${interaction.user}. <@${ownerId}> can reply again.`
      );

      await interaction.editReply(
        "Ticket reopened successfully."
      );

    } catch (error) {
      console.error("TICKET REOPEN ERROR:", error);

      const message =
        "Tixora couldn't reopen this ticket. Please check its permissions.";

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(message).catch(console.error);
      } else {
        await interaction.reply({
          content: message,
          ephemeral: true
        }).catch(console.error);
      }
    }

    return;
  }
});

startBot();
