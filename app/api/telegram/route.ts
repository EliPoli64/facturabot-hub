import { NextRequest, NextResponse } from 'next/server';
import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

// We'll use absolute URLs for our internal API calls since this is a serverless environment
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

bot.start((ctx) => ctx.reply('Welcome to FacturaBot! I am your autonomous retail operations engine. Send me an XML invoice, a photo of a receipt, or just ask me anything about your business.'));

bot.help((ctx) => ctx.reply('Commands:\n/start - Start the bot\n/help - Show this help\nSend an .xml file to process an invoice.\nSend a photo to extract ledger data.\nAsk questions like "What are my sales today?"'));

// Handle Documents (XML)
bot.on(message('document'), async (ctx) => {
  try {
    const doc = ctx.message.document;
    if (doc.file_name?.endsWith('.xml')) {
      const link = await ctx.telegram.getFileLink(doc.file_id);
      const response = await fetch(link.href);
      const xmlData = await response.text();

      const apiRes = await fetch(`${APP_URL}/api/factura/xml`, {
        method: 'POST',
        body: xmlData,
      });
      const result = await apiRes.json();
      
      ctx.reply(`XML Processed: ${result.type} saved. Transaction ID: ${result.transactionId}`);
    } else {
      ctx.reply('Please send a valid .xml invoice file.');
    }
  } catch (error) {
    ctx.reply('Error processing XML document.');
  }
});

// Handle Photos (OCR)
bot.on(message('photo'), async (ctx) => {
  try {
    const photo = ctx.message.photo.pop(); // Get highest resolution
    if (photo) {
      const link = await ctx.telegram.getFileLink(photo.file_id);
      const response = await fetch(link.href);
      const blob = await response.blob();
      
      const formData = new FormData();
      formData.append('file', blob, 'receipt.jpg');

      const apiRes = await fetch(`${APP_URL}/api/factura/image`, {
        method: 'POST',
        body: formData,
      });
      const result = await apiRes.json();
      
      ctx.reply(`Receipt Extracted:\nMerchant: ${result.data.merchantName}\nTotal: ${result.data.subTotal + result.data.taxAmount}\nType: ${result.data.type}`);
    }
  } catch (error) {
    ctx.reply('Error processing image.');
  }
});

// Handle Text (Chat)
bot.on(message('text'), async (ctx) => {
  try {
    const apiRes = await fetch(`${APP_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: ctx.message.text }),
    });
    const result = await apiRes.json();
    ctx.reply(result.text);
  } catch (error) {
    ctx.reply('I am having trouble connecting to the brain right now.');
  }
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await bot.handleUpdate(body);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Telegram Webhook Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
