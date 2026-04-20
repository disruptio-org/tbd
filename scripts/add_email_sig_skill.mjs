import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LOGO_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/brand-assets/moby-logo.png`;

const prompt = `Generate a complete, ready-to-use HTML email signature for the company.

CRITICAL RULES:
1. Output ONLY the HTML code — no markdown, no explanations, no guidelines, no code fences, no title
2. Use ONLY inline CSS styles (no <style> blocks, no external CSS)
3. Use table-based layout for maximum email client compatibility
4. Keep the signature compact (max ~130px height)
5. Use sans-serif fonts: Arial, Helvetica
6. The output must start with <table and end with </table>. Nothing else before or after.

STRUCTURE (left to right):
- LEFT: Company logo as <img> tag (64×64px, no border)
- RIGHT: Name (bold, 16px), Job Title (13px, gray), then a thin 1px separator line, then contact details (phone, email mailto link, website link bold), then company tagline in smaller muted text

BRANDING:
- Follow the company's visual identity from the project/company context provided
- Use the company's brand colors for accents (links, separators, tagline)
- If the company logo URL is available in context, USE IT as the <img src>. Otherwise use the text logo approach.
- The logo URL for this company is: ${LOGO_URL}

DESIGN RULES:
- Premium, institutional, minimal — no decorative elements
- Website is the primary CTA, make it bold and linked
- Email should be a mailto: link
- Phone should be a tel: link`;

const { data, error } = await db.from('AssistantSkill')
    .update({
        instructionPrompt: prompt,
        updatedAt: new Date().toISOString(),
    })
    .eq('key', 'email_signature_builder')
    .select('id');

if (error) console.error('Error:', error.message);
else console.log('Updated', data?.length, 'skill(s)');
process.exit(0);
