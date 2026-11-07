import { z } from 'zod';
import { errors } from './errors.js';

export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    throw errors.badRequest(
      first ? `${first.path.join('.') || '请求'}: ${first.message}` : '请求参数无效',
      result.error.flatten(),
    );
  }
  return result.data;
}

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('请输入有效的邮箱地址')
  .max(254);

export const passwordSchema = z.string().min(10, '密码至少需要 10 个字符').max(200);
export const uuidSchema = z.string().uuid('无效的 ID');

export const noteTitleSchema = z.string().trim().max(500, '标题过长');

export const noteContentSchema = z.string().max(2_000_000, '单篇笔记不能超过 2,000,000 个字符');

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(40),
  cursor: z.string().optional(),
});

export function clampString(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}
