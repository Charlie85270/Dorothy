import { exec } from 'child_process';
import { buildFullPath } from './path-builder';

interface GeneratedTask {
  title: string;
  description: string;
  projectPath: string;
  projectId: string;
  priority: 'low' | 'medium' | 'high';
  labels: string[];
  requiredSkills: string[];
}

/**
 * Use the Claude CLI to generate structured task details from a natural-language prompt.
 * Falls back to a simple extraction when the CLI call or JSON parsing fails.
 */
export async function generateTaskFromPrompt(
  prompt: string,
  availableProjects: Array<{ path: string; name: string }>,
): Promise<GeneratedTask> {
  const projectList = availableProjects.map(p => `- "${p.name}" (${p.path})`).join('\n');

  const claudePrompt = `You are a task parser. Analyze the user's request and generate structured task details.

Available projects:
${projectList}

User's request:
${prompt}

Based on this request, generate a JSON object with these fields:
- title: A concise task title (max 80 chars)
- description: The full task description (keep the original request, improve clarity if needed)
- projectPath: The most relevant project path from the list above (use exact path)
- priority: "low", "medium", or "high" based on urgency indicators
- labels: Array of relevant labels (e.g., "bug", "feature", "refactor", "ui", "api", "docs", "test", "security", "performance")
- requiredSkills: Array of skills the agent might need (e.g., "commit", "test", "deploy")

IMPORTANT: Respond with ONLY the JSON object, no markdown, no explanation, just valid JSON.`;

  const fullPath = buildFullPath();

  // Escape the prompt for shell
  const escapedPrompt = claudePrompt.replace(/'/g, "'\\''");

  // Call Claude CLI with -p flag for quick one-shot response using haiku for speed
  const command = `claude -p --model haiku '${escapedPrompt}'`;

  try {
    const claudeResult = await new Promise<string>((resolve, reject) => {
      exec(command, {
        env: { ...process.env, PATH: fullPath },
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024,
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('[Kanban] Claude CLI error:', stderr || error.message);
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      });
    });

    // Parse the JSON response
    let parsedTask;
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = claudeResult.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedTask = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseErr) {
      console.error('[Kanban] Failed to parse Claude response:', claudeResult);
      return buildFallbackTask(prompt, availableProjects);
    }

    // Validate and sanitize the response
    return {
      title: String(parsedTask.title || prompt.substring(0, 80)).substring(0, 80),
      description: String(parsedTask.description || prompt),
      projectPath: String(parsedTask.projectPath || availableProjects[0]?.path || ''),
      projectId: String(parsedTask.projectPath || availableProjects[0]?.path || ''),
      priority: ['low', 'medium', 'high'].includes(parsedTask.priority) ? parsedTask.priority : 'medium',
      labels: Array.isArray(parsedTask.labels) ? parsedTask.labels.slice(0, 5) : [],
      requiredSkills: Array.isArray(parsedTask.requiredSkills) ? parsedTask.requiredSkills.slice(0, 3) : [],
    };
  } catch (err) {
    console.error('[Kanban] Failed to generate task:', err);
    return buildFallbackTask(prompt, availableProjects);
  }
}

function buildFallbackTask(
  prompt: string,
  availableProjects: Array<{ path: string; name: string }>,
): GeneratedTask {
  const lines = prompt.split('\n').filter(l => l.trim());
  return {
    title: (lines[0] || prompt).substring(0, 80),
    description: prompt,
    projectPath: availableProjects[0]?.path || '',
    projectId: availableProjects[0]?.path || '',
    priority: 'medium',
    labels: [],
    requiredSkills: [],
  };
}
