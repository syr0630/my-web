import { requireAdminSession } from "@/lib/admin/auth";
import { listFeedback } from "@/lib/feedback/db";
import {
  isFeedbackCategory,
  isFeedbackStatus,
} from "@/lib/feedback/types";
import { AppError, errorResponse, jsonHeaders, makeRequestId } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = makeRequestId();

  try {
    await requireAdminSession();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const sort = searchParams.get("sort");
    const search = (searchParams.get("search") ?? "").trim().slice(0, 200);
    const page = Number(searchParams.get("page") ?? "1");

    if (category && !isFeedbackCategory(category)) {
      throw new AppError({
        message: "反馈类别筛选无效。",
        error_code: "INVALID_FILTER",
        status: 400,
      });
    }
    if (status && !isFeedbackStatus(status)) {
      throw new AppError({
        message: "处理状态筛选无效。",
        error_code: "INVALID_FILTER",
        status: 400,
      });
    }
    if (sort && sort !== "newest" && sort !== "oldest") {
      throw new AppError({
        message: "排序方式无效。",
        error_code: "INVALID_FILTER",
        status: 400,
      });
    }

    const result = listFeedback({
      search,
      category: isFeedbackCategory(category) ? category : null,
      status: isFeedbackStatus(status) ? status : null,
      sort: sort === "oldest" ? "oldest" : "newest",
      page: Number.isFinite(page) ? page : 1,
      pageSize: 20,
    });

    return Response.json(result, { headers: jsonHeaders(requestId) });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}