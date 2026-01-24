import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SKILLS_DATABASE } from '@/lib/skills-database';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

// GET all available skills from database
export async function GET() {
  return NextResponse.json({ skills: SKILLS_DATABASE });
}

// POST install a skill
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { repo, skillName } = body;

    if (!repo) {
      return NextResponse.json({ error: 'repo is required (format: owner/repo)' }, { status: 400 });
    }

    // Install using npx skills add
    const command = skillName
      ? `npx skills add ${repo}/${skillName}`
      : `npx skills add ${repo}`;

    const { stdout, stderr } = await execAsync(command, {
      timeout: 120000, // 2 minute timeout
    });

    return NextResponse.json({
      success: true,
      message: `Skill installed successfully`,
      output: stdout,
      error: stderr || undefined,
    });
  } catch (error: unknown) {
    const err = error as { message?: string; stderr?: string };
    return NextResponse.json({
      success: false,
      error: err.message || 'Installation failed',
      details: err.stderr,
    }, { status: 500 });
  }
}
