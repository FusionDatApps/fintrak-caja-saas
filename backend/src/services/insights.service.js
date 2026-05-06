// backend/src/services/insights.service.js

/**
 * Convierte un valor numérico a número seguro.
 */
function toNumber(value) {
  const n = Number(value ?? 0);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Formatea moneda COP para mensajes legibles.
 */
function moneyCOP(value) {
  const n = toNumber(value);
  return new Intl.NumberFormat("es-CO").format(n);
}

/**
 * Calcula porcentaje seguro.
 * Si la base es 0, retorna null para evitar división por cero.
 */
function safePercentage(part, total) {
  const p = toNumber(part);
  const t = toNumber(total);

  if (t === 0) return null;

  return Number(((p / t) * 100).toFixed(2));
}

/**
 * Calcula variación porcentual segura.
 * Si la base anterior es 0, retorna null.
 */
function safePctChange(previous, current) {
  const prev = toNumber(previous);
  const cur = toNumber(current);

  if (prev === 0) return null;

  return Number((((cur - prev) / prev) * 100).toFixed(2));
}

/**
 * Normaliza una categoría para análisis.
 */
function normalizeCategory(item) {
  return {
    category_id: item.category_id,
    category_name: item.category_name,
    total_amount: toNumber(item.total_amount),
    percentage: toNumber(item.percentage),
  };
}

/**
 * Construye insights básicos del mes.
 *
 * Entrada esperada:
 * {
 *   month,
 *   summary,
 *   categories
 * }
 *
 * Retorna:
 * {
 *   month,
 *   insights: string[]
 * }
 */
export function buildMonthlyInsights({ month, summary, categories }) {
  const income = toNumber(summary?.income);
  const expense = toNumber(summary?.expense);
  const balance = toNumber(summary?.balance);
  const normalizedCategories = Array.isArray(categories)
    ? categories.map(normalizeCategory)
    : [];

  const insights = [];

  if (income === 0 && expense === 0) {
    insights.push("No hay movimientos suficientes para generar análisis del mes.");

    return {
      month,
      insights,
    };
  }

  if (income > expense) {
    insights.push(`Tus ingresos superan tus gastos en $${moneyCOP(balance)}`);
  } else if (expense > income) {
    insights.push(`Tus gastos superan tus ingresos en $${moneyCOP(Math.abs(balance))}`);
  } else {
    insights.push("Tus ingresos y gastos están equilibrados.");
  }

  if (normalizedCategories.length > 0) {
    const top = normalizedCategories[0];
    insights.push(`Tu mayor gasto fue en "${top.category_name}" (${top.percentage}%)`);
  }

  if (income > 0) {
    const ratio = safePercentage(expense, income);
    insights.push(`Tus gastos representan el ${Math.round(ratio)}% de tus ingresos`);
  }

  return {
    month,
    insights,
  };
}

/**
 * Construye insights accionables avanzados.
 *
 * Entrada esperada:
 * {
 *   month,
 *   summary,
 *   categories,
 *   previousMonth,
 *   previousCategories,
 *   trendMonths
 * }
 *
 * Retorna:
 * {
 *   month,
 *   previous_month,
 *   insights: [
 *     {
 *       type,
 *       severity,
 *       title,
 *       message,
 *       metric
 *     }
 *   ]
 * }
 */
export function buildAdvancedInsights({
  month,
  summary,
  categories,
  previousMonth,
  previousCategories,
  trendMonths,
}) {
  const income = toNumber(summary?.income);
  const expense = toNumber(summary?.expense);
  const balance = toNumber(summary?.balance);

  const currentCategories = Array.isArray(categories)
    ? categories.map(normalizeCategory)
    : [];

  const previousCategoryMap = new Map(
    Array.isArray(previousCategories)
      ? previousCategories.map((item) => {
          const normalized = normalizeCategory(item);
          return [normalized.category_name, normalized];
        })
      : []
  );

  const insights = [];

  // 1) Salud del balance mensual
  if (income === 0 && expense === 0) {
    insights.push({
      type: "empty_month",
      severity: "info",
      title: "Mes sin actividad",
      message: "No hay suficientes movimientos para generar recomendaciones accionables.",
      metric: null,
    });

    return {
      month,
      previous_month: previousMonth,
      insights,
    };
  }

  if (balance > 0) {
    insights.push({
      type: "positive_balance",
      severity: "success",
      title: "Balance positivo",
      message: `Tus ingresos superan tus gastos en $${moneyCOP(balance)}.`,
      metric: {
        balance,
      },
    });
  } else if (balance < 0) {
    insights.push({
      type: "negative_balance",
      severity: "danger",
      title: "Balance negativo",
      message: `Tus gastos superan tus ingresos en $${moneyCOP(Math.abs(balance))}. Debes revisar gastos prioritarios antes de seguir aumentando compromisos.`,
      metric: {
        balance,
      },
    });
  } else {
    insights.push({
      type: "balanced_month",
      severity: "warning",
      title: "Mes equilibrado",
      message: "Tus ingresos y gastos están equilibrados. No estás perdiendo, pero tampoco estás generando margen.",
      metric: {
        balance,
      },
    });
  }

  // 2) Ratio de gasto sobre ingreso
  if (income > 0) {
    const expenseRatio = safePercentage(expense, income);

    if (expenseRatio >= 100) {
      insights.push({
        type: "expense_ratio",
        severity: "danger",
        title: "Gastos por encima de ingresos",
        message: `Tus gastos representan el ${Math.round(expenseRatio)}% de tus ingresos. El mes está financieramente comprometido.`,
        metric: {
          expense_ratio: expenseRatio,
        },
      });
    } else if (expenseRatio >= 80) {
      insights.push({
        type: "expense_ratio",
        severity: "warning",
        title: "Gasto alto",
        message: `Tus gastos representan el ${Math.round(expenseRatio)}% de tus ingresos. Hay poco margen para ahorro o reinversión.`,
        metric: {
          expense_ratio: expenseRatio,
        },
      });
    } else {
      insights.push({
        type: "expense_ratio",
        severity: "success",
        title: "Margen saludable",
        message: `Tus gastos representan el ${Math.round(expenseRatio)}% de tus ingresos. El mes mantiene margen operativo.`,
        metric: {
          expense_ratio: expenseRatio,
        },
      });
    }
  }

  // 3) Categoría dominante
  if (currentCategories.length > 0) {
    const top = currentCategories[0];

    const severity = top.percentage >= 40 ? "warning" : "info";

    insights.push({
      type: "top_category",
      severity,
      title: "Categoría dominante",
      message: `Tu mayor gasto fue "${top.category_name}" con $${moneyCOP(top.total_amount)}, equivalente al ${top.percentage}% de tus gastos.`,
      metric: {
        category_name: top.category_name,
        total_amount: top.total_amount,
        percentage: top.percentage,
      },
    });
  }

  // 4) Aumento fuerte por categoría vs mes anterior
  const categoryChanges = currentCategories
    .map((current) => {
      const previous = previousCategoryMap.get(current.category_name);
      const previousAmount = toNumber(previous?.total_amount);
      const currentAmount = toNumber(current.total_amount);
      const pct_change = safePctChange(previousAmount, currentAmount);

      return {
        category_name: current.category_name,
        previous_amount: previousAmount,
        current_amount: currentAmount,
        pct_change,
        absolute_change: currentAmount - previousAmount,
      };
    })
    .filter((item) => item.current_amount > 0);

  const strongestIncrease = categoryChanges
    .filter((item) => item.pct_change !== null && item.pct_change >= 25)
    .sort((a, b) => b.pct_change - a.pct_change)[0];

  if (strongestIncrease) {
    insights.push({
      type: "category_increase",
      severity: strongestIncrease.pct_change >= 50 ? "warning" : "info",
      title: "Aumento fuerte por categoría",
      message: `El gasto en "${strongestIncrease.category_name}" aumentó ${strongestIncrease.pct_change}% frente a ${previousMonth}. Subió de $${moneyCOP(strongestIncrease.previous_amount)} a $${moneyCOP(strongestIncrease.current_amount)}.`,
      metric: strongestIncrease,
    });
  }

  // 5) Nueva categoría de gasto frente al mes anterior
  const newCategory = categoryChanges.find(
    (item) => item.previous_amount === 0 && item.current_amount > 0
  );

  if (newCategory) {
    insights.push({
      type: "new_category_spending",
      severity: "info",
      title: "Nueva categoría de gasto",
      message: `"${newCategory.category_name}" aparece como gasto nuevo frente a ${previousMonth}, con $${moneyCOP(newCategory.current_amount)}.`,
      metric: newCategory,
    });
  }

  // 6) Tendencia reciente de balance
  const normalizedTrend = Array.isArray(trendMonths)
    ? trendMonths.map((item) => ({
        month: item.month,
        balance: toNumber(item.balance),
      }))
    : [];

  if (normalizedTrend.length >= 3) {
    const lastThree = normalizedTrend.slice(-3);

    const isFalling =
      lastThree[0].balance > lastThree[1].balance &&
      lastThree[1].balance > lastThree[2].balance;

    const isRising =
      lastThree[0].balance < lastThree[1].balance &&
      lastThree[1].balance < lastThree[2].balance;

    if (isFalling) {
      insights.push({
        type: "balance_trend",
        severity: "warning",
        title: "Tendencia negativa",
        message: `Tu balance viene cayendo durante los últimos 3 meses analizados: ${lastThree
          .map((item) => `${item.month}: $${moneyCOP(item.balance)}`)
          .join(" → ")}.`,
        metric: {
          months: lastThree,
        },
      });
    }

    if (isRising) {
      insights.push({
        type: "balance_trend",
        severity: "success",
        title: "Tendencia positiva",
        message: `Tu balance viene mejorando durante los últimos 3 meses analizados: ${lastThree
          .map((item) => `${item.month}: $${moneyCOP(item.balance)}`)
          .join(" → ")}.`,
        metric: {
          months: lastThree,
        },
      });
    }
  }

  return {
    month,
    previous_month: previousMonth,
    insights,
  };
}
export function buildFinancialHealthScore({
  month,
  summary,
  categories,
  previousSummary,
}) {
  const income = Number(summary?.income || 0);
  const expense = Number(summary?.expense || 0);
  const balance = Number(summary?.balance || 0);

  const prevBalance = Number(previousSummary?.balance || 0);

  const expenseRatio = income === 0 ? 0 : (expense / income) * 100;
  const savingsRatio = income === 0 ? 0 : (balance / income) * 100;

  let score = 50;

  const alerts = [];

  // =====================================
  // BALANCE POSITIVO
  // =====================================
  if (balance > 0) {
    score += 30;
  } else {
    score -= 40;

    alerts.push({
      type: "negative_balance",
      severity: "danger",
      message: "Tus gastos superan tus ingresos.",
    });
  }

  // =====================================
  // RELACIÓN GASTO / INGRESO
  // =====================================
  if (expenseRatio < 70) {
    score += 25;
  } else if (expenseRatio >= 90) {
    score -= 30;

    alerts.push({
      type: "high_expense_ratio",
      severity: "warning",
      message: "Tus gastos consumen más del 90% de tus ingresos.",
    });
  }

  // =====================================
  // CAPACIDAD DE AHORRO
  // =====================================
  if (savingsRatio >= 20) {
    score += 25;
  }

  // =====================================
  // CATEGORÍA DOMINANTE
  // =====================================
  const topCategory = categories?.[0];

  if (topCategory && Number(topCategory.percentage) > 60) {
    score -= 15;

    alerts.push({
      type: "expense_concentration",
      severity: "warning",
      message: `La categoría "${topCategory.category_name}" domina ${topCategory.percentage}% de tus gastos.`,
    });
  } else {
    score += 10;
  }

  // =====================================
  // TENDENCIA VS MES ANTERIOR
  // =====================================
  if (prevBalance > 0 && balance < prevBalance * 0.6) {
    score -= 20;

    alerts.push({
      type: "balance_drop",
      severity: "warning",
      message: "Tu balance cayó fuertemente frente al mes anterior.",
    });
  } else {
    score += 10;
  }

  // =====================================
  // NORMALIZAR SCORE
  // =====================================
  score = Math.max(0, Math.min(100, Math.round(score)));

  // =====================================
  // STATUS FINAL
  // =====================================
  let status = "risky";

  if (score >= 80) {
    status = "healthy";
  } else if (score >= 60) {
    status = "stable";
  }

  return {
    month,
    score,
    status,
    metrics: {
      income,
      expense,
      balance,
      expense_ratio: Number(expenseRatio.toFixed(2)),
      savings_ratio: Number(savingsRatio.toFixed(2)),
    },
    alerts,
  };
}
export function buildSmartRecommendations({
  month,
  summary,
  categories,
  previousSummary,
}) {
  const income = toNumber(summary?.income);
  const expense = toNumber(summary?.expense);
  const balance = toNumber(summary?.balance);

  const prevBalance = toNumber(previousSummary?.balance);

  const expenseRatio = safePercentage(expense, income) || 0;
  const savingsRatio = safePercentage(balance, income) || 0;

  const recommendations = [];

  const topCategory = Array.isArray(categories) ? categories[0] : null;

  // =====================================
  // BALANCE NEGATIVO
  // =====================================
  if (balance < 0) {
    recommendations.push({
      priority: "high",
      type: "negative_balance",
      title: "Reducir gastos urgentes",
      message:
        "Tus gastos superan tus ingresos. Debes reducir gastos no esenciales inmediatamente.",
    });
  }

  // =====================================
  // GASTOS MUY ALTOS
  // =====================================
  if (expenseRatio >= 90) {
    recommendations.push({
      priority: "high",
      type: "critical_expense_ratio",
      title: "Controlar nivel de gasto",
      message: `Tus gastos consumen ${Math.round(
        expenseRatio
      )}% de tus ingresos. El margen operativo es críticamente bajo.`,
    });
  } else if (expenseRatio >= 70) {
    recommendations.push({
      priority: "medium",
      type: "high_expense_ratio",
      title: "Optimizar gastos",
      message:
        "Tus gastos están creciendo demasiado frente a tus ingresos. Intenta reducir costos variables.",
    });
  }

  // =====================================
  // BAJO AHORRO
  // =====================================
  if (savingsRatio < 15 && income > 0) {
    recommendations.push({
      priority: "medium",
      type: "low_savings",
      title: "Mejorar capacidad de ahorro",
      message: `Tu capacidad de ahorro es solo ${Math.round(
        savingsRatio
      )}%. Considera establecer una meta mínima del 20%.`,
    });
  }

  // =====================================
  // CONCENTRACIÓN DE GASTOS
  // =====================================
  if (topCategory && Number(topCategory.percentage) >= 70) {
    recommendations.push({
      priority: "high",
      type: "expense_concentration",
      title: "Reducir concentración de gastos",
      message: `La categoría "${topCategory.category_name}" representa ${topCategory.percentage}% de tus gastos. Existe dependencia excesiva en una sola categoría.`,
    });
  } else if (topCategory && Number(topCategory.percentage) >= 50) {
    recommendations.push({
      priority: "medium",
      type: "moderate_concentration",
      title: "Diversificar gastos",
      message: `La categoría "${topCategory.category_name}" concentra más de la mitad de tus gastos.`,
    });
  }

  // =====================================
  // CAÍDA VS MES ANTERIOR
  // =====================================
  if (prevBalance > 0 && balance < prevBalance * 0.5) {
    recommendations.push({
      priority: "high",
      type: "balance_drop",
      title: "Revisar caída financiera",
      message:
        "Tu balance cayó fuertemente frente al mes anterior. Revisa cambios operativos o aumentos recientes de gasto.",
    });
  }

  // =====================================
  // RECOMENDACIÓN POSITIVA
  // =====================================
  if (recommendations.length === 0) {
    recommendations.push({
      priority: "low",
      type: "healthy_finances",
      title: "Mantener estrategia actual",
      message:
        "Tus métricas financieras son saludables. Mantén disciplina de gasto y ahorro.",
    });
  }

  return {
    month,
    recommendations,
  };
}