
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
  AttachmentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

require("dotenv").config();

const { loadCommands } = require("./handlers/commandHandler");
const { loadData, saveData } = require("./utils/dataManager");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

let storageQueue = Promise.resolve();

async function updateData(name, updater) {
  const operation = storageQueue.then(async () => {
    const data = await loadData(name);
    const result = await updater(data);
    await saveData(name, data);
    return result;
  });

  storageQueue = operation.catch(() => {});
  return operation;
}

async function getGuildConfig(guildId) {
  const configs = await loadData("config");
  return configs[guildId] || null;
}

async function getTicket(guildId, channelId) {
  const tickets = await loadData("tickets");
  return tickets[guildId]?.[channelId] || null;
}

async function updateTicket(guildId, channelId, changes) {
  return updateData("tickets", data => {
    if (!data[guildId]) data[guildId] = {};
    if (!data[guildId][channelId]) return null;

    Object.assign(data[guildId][channelId], changes);
    data[guildId][channelId].updatedAt = new Date().toISOString();

    return data[guildId][channelId];
  });
}

async function allocateTicketNumber(guildId) {
  return updateData("counters", counters => {
    const next = (Number(counters[guildId]) || 0) + 1;
    counters[guildId] = next;
    return next;
  });
}

async function saveNewTicket(guildId, channelId, ticketData) {
  return updateData("tickets", tickets => {
    if (!tickets[guildId]) tickets[guildId] = {};
    tickets[guildId][channelId] = ticketData;
    return ticketData;
  });
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

  const ticket = await getTicket(channel.guild.id, channel.id);

  const lines = [
    "TIXORA TICKET TRANSCRIPT",
    `Server: ${channel.guild.name}`,
    `Channel: #${channel.name}`,
    `Ticket Number: ${ticket?.ticketNumber ?? "Unknown"}`,
    `Ticket ID: ${channel.id}`,
    `Close reason: ${ticket?.closeReason || "Not provided"}`,
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

async function startBot() {
  try {
    await loadCommands(client);
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    console.error("TIXORA STARTUP ERROR:", error);
    process.exit(1);
  }
}

client.once("ready", () => {
  console.log("--------------------------------");
  console.log(`Tixora is online as ${client.user.tag}`);
  console.log(`Serving ${client.guilds.cache.size} servers`);
  console.log("--------------------------------");

  client.user.setPresence({
    activities: [{ name: "support tickets", type: ActivityType.Watching }],
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

    let ticketChannel;

    try {
      const config = await getGuildConfig(interaction.guild.id);

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

      const ticketNumber = await allocateTicketNumber(interaction.guild.id);

      const ticketName = `ticket-${String(ticketNumber).padStart(4, "0")}-${interaction.user.username}`
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .slice(0, 100);

      ticketChannel = await interaction.guild.channels.create({
        name: ticketName,
        type: ChannelType.GuildText,
        topic:
          `Ticket owner: ${interaction.user.id} | ` +
          `Ticket number: ${ticketNumber} | ` +
          `Category: ${categoryName} | Original category: none`,
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

      const ticketRecord = {
        guildId: interaction.guild.id,
        channelId: ticketChannel.id,
        ticketNumber,
        ownerId: interaction.user.id,
        categoryKey: interaction.values[0],
        categoryName,
        staffRoleId: staffRole.id,
        status: "open",
        claimedBy: null,
        closeReason: null,
        closedBy: null,
        originalParentId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        closedAt: null,
        reopenedAt: null
      };

      await saveNewTicket(
        interaction.guild.id,
        ticketChannel.id,
        ticketRecord
      );

      const ticketEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`Tixora Support Ticket #${String(ticketNumber).padStart(4, "0")}`)
        .setDescription(
          `Welcome ${interaction.user}!\n\n` +
          `**Ticket Number:** #${String(ticketNumber).padStart(4, "0")}\n` +
          `**Category:** ${categoryName}\n` +
          `**Staff Team:** ${staffRole}\n\n` +
          "Please describe your issue. A staff member will assist you soon."
        )
        .setFooter({ text: "Tixora Support System" })
        .setTimestamp();

      await ticketChannel.send({
        content: `${interaction.user} ${staffRole}`,
        embeds: [ticketEmbed],
        components: [ticketButtons()]
      });

      await interaction.editReply(
        `Your ticket #${String(ticketNumber).padStart(4, "0")} has been created: ${ticketChannel}`
      );
    } catch (error) {
      console.error("TICKET CREATION ERROR:", error);

      if (ticketChannel) {
        await ticketChannel.delete("Ticket setup failed").catch(console.error);
      }

      await interaction.editReply(
        "Tixora couldn't create your ticket. Please check its server permissions and storage files."
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

      const config = await getGuildConfig(interaction.guild.id);
      const staffRole = config
        ? interaction.guild.roles.cache.get(config.staffRoleId)
        : null;

      if (!staffRole) {
        return interaction.reply({
          content: "The configured staff role could not be found.",
          ephemeral: true
        });
      }

      const member = await interaction.guild.members.fetch(interaction.user.id);

      if (!member.roles.cache.has(staffRole.id)) {
        return interaction.reply({
          content: "Only support staff can claim tickets.",
          ephemeral: true
        });
      }

      const ticket = await getTicket(interaction.guild.id, channel.id);

      if (ticket?.status === "closed") {
        return interaction.reply({
          content: "This ticket is closed. Reopen it before claiming it.",
          ephemeral: true
        });
      }

      if (ticket?.claimedBy || channel.topic.includes("Claimed by:")) {
        return interaction.reply({
          content: "This ticket has already been claimed.",
          ephemeral: true
        });
      }

      await channel.setTopic(
        `${channel.topic} | Claimed by: ${interaction.user.id}`
      );

      await updateTicket(interaction.guild.id, channel.id, {
        claimedBy: interaction.user.id
      });

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

      const config = await getGuildConfig(interaction.guild.id);
      const staffRole = config
        ? interaction.guild.roles.cache.get(config.staffRoleId)
        : null;

      if (!staffRole) {
        return interaction.reply({
          content: "The configured staff role could not be found.",
          ephemeral: true
        });
      }

      const member = await interaction.guild.members.fetch(interaction.user.id);

      if (!member.roles.cache.has(staffRole.id)) {
        return interaction.reply({
          content: "Only support staff can unclaim tickets.",
          ephemeral: true
        });
      }

      if (!channel.topic.includes("Claimed by:")) {
        return interaction.reply({
          content: "This ticket isn't currently claimed.",
          ephemeral: true
        });
      }

      const updatedTopic = channel.topic
        .replace(/\s*\|\s*Claimed by: \d+/g, "")
        .trim();

      await channel.setTopic(updatedTopic);

      await updateTicket(interaction.guild.id, channel.id, {
        claimedBy: null
      });

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

  // Close ticket button - show the modal immediately
  if (
    interaction.isButton() &&
    interaction.customId === "tixora_close_ticket"
  ) {
    console.log("CLOSE BUTTON HANDLER REACHED");
    const channel = interaction.channel;

    if (!channel?.topic?.includes("Ticket owner:")) {
      return interaction.reply({
        content: "This button can only be used inside a Tixora ticket.",
        ephemeral: true
      });
    }

    const reasonInput = new TextInputBuilder()
      .setCustomId("close_reason")
      .setLabel("Why is this ticket being closed?")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Briefly explain why this ticket is being closed...")
      .setMinLength(3)
      .setMaxLength(500)
      .setRequired(true);

    const modal = new ModalBuilder()
      .setCustomId("tixora_close_reason_submit")
      .setTitle("Close Support Ticket")
      .addComponents(
        new ActionRowBuilder().addComponents(reasonInput)
      );

    try {
      await interaction.showModal(modal);
    } catch (error) {
      console.error("CLOSE MODAL ERROR:", error);
    }

    return;
  }

  // Submit close reason, save transcript, and archive ticket
  if (
    interaction.isModalSubmit() &&
    interaction.customId === "tixora_close_reason_submit"
  ) {
    const channel = interaction.channel;

    if (!channel?.topic?.includes("Ticket owner:")) {
      return interaction.reply({
        content: "This is no longer a valid Tixora ticket.",
        ephemeral: true
      });
    }

    try {
      const reason = interaction.fields.getTextInputValue("close_reason").trim();

      if (reason.length < 3) {
        return interaction.reply({
          content: "Please enter a close reason with at least 3 characters.",
          ephemeral: true
        });
      }

      const ownerMatch = channel.topic.match(/Ticket owner: (\d+)/);
      const ownerId = ownerMatch ? ownerMatch[1] : null;

      const config = await getGuildConfig(interaction.guild.id);
      const staffRole = config
        ? interaction.guild.roles.cache.get(config.staffRoleId)
        : null;

      const member = await interaction.guild.members.fetch(interaction.user.id);
      const isOwner = ownerId === interaction.user.id;
      const isStaff = Boolean(staffRole && member.roles.cache.has(staffRole.id));

      if (!ownerId || (!isOwner && !isStaff)) {
        return interaction.reply({
          content: "Only the ticket owner or support staff can close this ticket.",
          ephemeral: true
        });
      }

      const ticket = await getTicket(interaction.guild.id, channel.id);

      if (ticket?.status === "closed") {
        return interaction.reply({
          content: "This ticket is already closed.",
          ephemeral: true
        });
      }

      const logChannel = interaction.guild.channels.cache.find(ch =>
        ch.name === "ticket-logs" && ch.type === ChannelType.GuildText
      );

      if (!logChannel) {
        return interaction.reply({
          content: "I couldn't find #ticket-logs. The ticket has been kept open.",
          ephemeral: true
        });
      }

      const closedCategory = interaction.guild.channels.cache.find(ch =>
        ch.name === "Closed Tickets" && ch.type === ChannelType.GuildCategory
      );

      if (!closedCategory) {
        return interaction.reply({
          content: "I couldn't find the Closed Tickets category. The ticket has been kept open.",
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const safeReason = reason.slice(0, 500);

      const topicWithoutOldReason = (channel.topic || "")
        .replace(/\s*\|\s*Close reason: [^|]*/g, "")
        .trim();

      await channel.setTopic(
        `${topicWithoutOldReason} | Close reason: ${safeReason}`.slice(0, 1024)
      );

      const transcriptBuffer = await createTranscript(channel);

      const transcriptFile = new AttachmentBuilder(transcriptBuffer, {
        name: `tixora-${channel.name}-${channel.id}.txt`
      });

      const ticketNumber = ticket?.ticketNumber ?? "Unknown";

      const transcriptEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("Ticket Transcript")
        .setDescription(
          "A ticket has been closed and archived. Its transcript has been saved.\n\n" +
          `**Ticket:** #${channel.name}\n` +
          `**Ticket Number:** #${ticketNumber}\n` +
          `**Closed by:** ${interaction.user}\n` +
          `**Ticket ID:** ${channel.id}\n` +
          `**Close reason:** ${safeReason}`
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

      await updateTicket(interaction.guild.id, channel.id, {
        status: "closed",
        closeReason: safeReason,
        closedBy: interaction.user.id,
        closedAt: new Date().toISOString()
      });

      const recentMessages = await channel.messages.fetch({ limit: 50 });

      const controlsMessage = recentMessages.find(message =>
        message.author.id === client.user.id &&
        message.components.length > 0
      );

      if (controlsMessage) {
        await controlsMessage.edit({
          components: [ticketButtons({ closed: true })]
        });
      }

      await channel.send(
        `🔒 This ticket has been closed by ${interaction.user}.\n` +
        `**Reason:** ${safeReason}\n` +
        "The transcript has been saved and the ticket moved to **Closed Tickets**."
      );

      await interaction.editReply(
        "Ticket successfully closed! The reason and transcript have been saved."
      );
    } catch (error) {
      console.error("TICKET CLOSE/ARCHIVE ERROR:", error);

      const message =
        "Tixora couldn't finish archiving this ticket. Please check its permissions.";

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

  // Reopen archived ticket
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

      const config = await getGuildConfig(interaction.guild.id);
      const staffRole = config
        ? interaction.guild.roles.cache.get(config.staffRoleId)
        : null;

      if (!staffRole) {
        return interaction.reply({
          content: "The configured staff role could not be found.",
          ephemeral: true
        });
      }

      const member = await interaction.guild.members.fetch(interaction.user.id);

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

      const ticket = await getTicket(interaction.guild.id, channel.id);

      if (ticket?.status !== "closed") {
        return interaction.reply({
          content: "This ticket is not currently marked as closed.",
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });

      await channel.permissionOverwrites.edit(ownerId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      });

      await channel.setParent(ticket.originalParentId || null);

      const claimed = Boolean(ticket.claimedBy);

      await updateTicket(interaction.guild.id, channel.id, {
        status: "open",
        reopenedAt: new Date().toISOString()
      });

      await interaction.message.edit({
        components: [ticketButtons({ claimed })]
      });

      await channel.send(
        `🔓 This ticket has been reopened by ${interaction.user}. <@${ownerId}> can reply again.`
      );

      await interaction.editReply("Ticket reopened successfully.");
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
