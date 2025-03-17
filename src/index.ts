#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class BrowserUseServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'browser-use-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'execute_browser_task',
          description: '执行浏览器自动化任务',
          inputSchema: {
            type: 'object',
            properties: {
              task: {
                type: 'string',
                description: '要执行的任务描述',
              },
            },
            required: ['task'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== 'execute_browser_task') {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `未知工具: ${request.params.name}`
        );
      }

      const { task } = request.params.arguments as { task: string };

      try {
        const result = await this.executeBrowserTask(task);
        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `执行出错: ${error?.message || '未知错误'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async executeBrowserTask(task: string): Promise<string> {
    const command = `cd /Users/charlesqin/PycharmProjects/PythonProject && \
source /Users/charlesqin/PycharmProjects/PythonProject/.venv/bin/activate && \
python app.py --task "${task}"`;

    try {
      const { stdout, stderr } = await execAsync(command);
      if (stderr) {
        console.error('执行命令时出现警告:', stderr);
      }
      return stdout || '任务执行完成，但没有输出结果';
    } catch (error: any) {
      throw new Error(`执行命令失败: ${error?.message || '未知错误'}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Browser Use MCP server running on stdio');
  }
}

const server = new BrowserUseServer();
server.run().catch(console.error);
