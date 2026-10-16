import React, { useState, useEffect, useRef } from 'react';
import { 
  Calculator, 
  X, 
  Copy, 
  Check, 
  RotateCcw, 
  Percent, 
  TrendingUp, 
  Receipt, 
  Landmark, 
  History, 
  ChevronRight,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface ScientificCalculatorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyValue?: (value: number) => void;
  defaultCurrency?: string;
  defaultTaxRate?: number;
}

type TabType = 'scientific' | 'margin' | 'vat' | 'loan';

interface HistoryItem {
  id: string;
  expression: string;
  result: string;
  time: string;
}

export const ScientificCalculatorDrawer: React.FC<ScientificCalculatorDrawerProps> = ({
  isOpen,
  onClose,
  onApplyValue,
  defaultCurrency = 'TZS',
  defaultTaxRate = 18
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('scientific');
  const [copied, setCopied] = useState<string | null>(null);

  // --- SCIENTIFIC STATE ---
  const [expression, setExpression] = useState<string>('');
  const [display, setDisplay] = useState<string>('0');
  const [isNewCalculation, setIsNewCalculation] = useState<boolean>(false);
  const [isRad, setIsRad] = useState<boolean>(false);
  const [memory, setMemory] = useState<number>(0);
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('tradecore_calc_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showHistory, setShowHistory] = useState<boolean>(false);

  // --- MARGIN STATE ---
  const [costPrice, setCostPrice] = useState<string>('');
  const [sellPrice, setSellPrice] = useState<string>('');
  const [targetMarginPct, setTargetMarginPct] = useState<string>('');
  const [targetMarkupPct, setTargetMarkupPct] = useState<string>('');

  // --- VAT STATE ---
  const [vatAmount, setVatAmount] = useState<string>('');
  const [vatRate, setVatRate] = useState<number>(defaultTaxRate);
  const [vatMode, setVatMode] = useState<'exclusive' | 'inclusive'>('exclusive');

  // --- LOAN / EMI STATE ---
  const [loanPrincipal, setLoanPrincipal] = useState<string>('');
  const [loanRateAnnual, setLoanRateAnnual] = useState<string>('15');
  const [loanTermMonths, setLoanTermMonths] = useState<string>('12');
  const [showAmortization, setShowAmortization] = useState<boolean>(false);

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('tradecore_calc_history', JSON.stringify(history.slice(0, 30)));
    } catch {}
  }, [history]);

  const copyToClipboard = (val: string, label: string) => {
    try {
      navigator.clipboard.writeText(val);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback
    }
  };

  // --- SCIENTIFIC CALCULATION LOGIC ---
  const handleDigit = (digit: string) => {
    if (isNewCalculation || display === '0' || display === 'Error') {
      setDisplay(digit);
      if (isNewCalculation) {
        setExpression('');
        setIsNewCalculation(false);
      }
    } else {
      setDisplay(prev => prev + digit);
    }
  };

  const handleDecimal = () => {
    if (isNewCalculation || display === 'Error') {
      setDisplay('0.');
      setExpression('');
      setIsNewCalculation(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(prev => prev + '.');
    }
  };

  const handleOperator = (op: string) => {
    setIsNewCalculation(false);
    if (display === 'Error') {
      setDisplay('0');
      setExpression('');
      return;
    }

    setExpression(prev => {
      const trimmed = prev.trim();
      // If user presses another operator without typing a new number, swap the operator
      if (display === '0' && trimmed && /[+\-×÷^]$/.test(trimmed)) {
        return `${trimmed.slice(0, -1)} ${op}`.trim();
      }
      if (trimmed) {
        return `${trimmed} ${display} ${op}`;
      }
      return `${display} ${op}`;
    });
    setDisplay('0');
  };

  const handleBracket = (bracket: '(' | ')') => {
    setIsNewCalculation(false);
    if (bracket === '(') {
      setExpression(prev => (prev ? `${prev} (` : '('));
      setDisplay('0');
    } else {
      setExpression(prev => `${prev} ${display} )`.trim());
      setDisplay('0');
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setExpression('');
    setIsNewCalculation(false);
  };

  const handleClearEntry = () => {
    setDisplay('0');
    setIsNewCalculation(false);
  };

  const handleBackspace = () => {
    if (isNewCalculation || display === 'Error') {
      setDisplay('0');
      setIsNewCalculation(false);
      return;
    }
    if (display.length > 1) {
      setDisplay(prev => prev.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  const handleSignToggle = () => {
    if (display === '0' || display === 'Error') return;
    if (display.startsWith('-')) {
      setDisplay(display.slice(1));
    } else {
      setDisplay('-' + display);
    }
  };

  const handlePercentage = () => {
    const val = parseFloat(display);
    if (isNaN(val)) return;

    // Check if expression ends with an operator and a previous base number
    const match = expression.match(/([0-9.]+)\s*([+\-×÷^])\s*$/);
    if (match) {
      const baseNum = parseFloat(match[1]);
      const op = match[2];
      if (op === '+' || op === '-') {
        // e.g., 200 + 10% => 10% of 200 = 20
        const pctAmount = (baseNum * val) / 100;
        const rounded = Number(pctAmount.toFixed(10)).toString();
        setDisplay(rounded);
        return;
      }
    }

    const simplePct = val / 100;
    setDisplay(Number(simplePct.toFixed(10)).toString());
  };

  const handleScientificFunction = (fn: string) => {
    const val = parseFloat(display);
    if (isNaN(val)) return;

    let res = 0;
    const factor = isRad ? 1 : Math.PI / 180;

    switch (fn) {
      case 'sin':
        res = Math.sin(val * factor);
        break;
      case 'cos':
        res = Math.cos(val * factor);
        break;
      case 'tan':
        res = Math.tan(val * factor);
        break;
      case 'sqrt':
        if (val < 0) {
          setDisplay('Error');
          return;
        }
        res = Math.sqrt(val);
        break;
      case 'sqr':
        res = val * val;
        break;
      case 'inv':
        if (val === 0) {
          setDisplay('Error');
          return;
        }
        res = 1 / val;
        break;
      case 'log':
        if (val <= 0) {
          setDisplay('Error');
          return;
        }
        res = Math.log10(val);
        break;
      case 'ln':
        if (val <= 0) {
          setDisplay('Error');
          return;
        }
        res = Math.log(val);
        break;
      case 'fact':
        if (val < 0 || val > 170 || !Number.isInteger(val)) {
          setDisplay('Error');
          return;
        }
        let f = 1;
        for (let i = 2; i <= val; i++) f *= i;
        res = f;
        break;
      case 'pi':
        res = Math.PI;
        break;
      case 'e':
        res = Math.E;
        break;
      case 'pct':
        handlePercentage();
        return;
      default:
        return;
    }

    // Clean rounding for floating point issues
    const rounded = Number(res.toFixed(10)).toString();
    setDisplay(rounded);
    setIsNewCalculation(false);
  };

  const handleEvaluate = () => {
    try {
      let fullExpr = `${expression} ${display !== '0' || !expression ? display : ''}`.trim();
      if (!fullExpr) return;

      // Automatically balance unclosed parentheses
      const openCount = (fullExpr.match(/\(/g) || []).length;
      const closeCount = (fullExpr.match(/\)/g) || []).length;
      if (openCount > closeCount) {
        fullExpr = fullExpr + ' )'.repeat(openCount - closeCount);
      }

      // Safe arithmetic evaluator
      // Replace symbols with JS operators
      const sanitized = fullExpr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/\^/g, '**');

      // Validate allowed characters strictly
      if (!/^[0-9+\-*/().\s**eE]+$/.test(sanitized)) {
        setDisplay('Error');
        return;
      }

      // eslint-disable-next-line no-new-func
      const resultVal = Function(`'use strict'; return (${sanitized})`)();
      if (typeof resultVal !== 'number' || isNaN(resultVal) || !isFinite(resultVal)) {
        setDisplay('Error');
        return;
      }

      const resStr = Number(resultVal.toFixed(10)).toString();
      const newHistoryItem: HistoryItem = {
        id: `calc_${Date.now()}_${Math.random()}`,
        expression: fullExpr,
        result: resStr,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setHistory(prev => [newHistoryItem, ...prev].slice(0, 30));
      setDisplay(resStr);
      setExpression('');
      setIsNewCalculation(true);
    } catch {
      setDisplay('Error');
    }
  };

  // Full Keyboard listener (Esc, 0-9, operators, Enter, Backspace, C, brackets, etc.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Do not hijack typing inside text inputs on Margin / VAT / Loan tabs
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      if (activeTab === 'scientific') {
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          handleDigit(e.key);
        } else if (e.key === '.') {
          e.preventDefault();
          handleDecimal();
        } else if (e.key === '+' || e.key === '-') {
          e.preventDefault();
          handleOperator(e.key);
        } else if (e.key === '*') {
          e.preventDefault();
          handleOperator('×');
        } else if (e.key === '/') {
          e.preventDefault();
          handleOperator('÷');
        } else if (e.key === 'Enter' || e.key === '=') {
          e.preventDefault();
          handleEvaluate();
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          handleBackspace();
        } else if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          handleClear();
        } else if (e.key === '(' || e.key === ')') {
          e.preventDefault();
          handleBracket(e.key as any);
        } else if (e.key === '%') {
          e.preventDefault();
          handlePercentage();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTab, display, expression, isNewCalculation, onClose]);

  // --- MARGIN & MARKUP CALCULATIONS ---
  const cost = parseFloat(costPrice) || 0;
  const sell = parseFloat(sellPrice) || 0;
  const profit = sell - cost;
  const marginPct = sell > 0 ? (profit / sell) * 100 : 0;
  const markupPct = cost > 0 ? (profit / cost) * 100 : 0;

  const targetFromMargin = (() => {
    const m = parseFloat(targetMarginPct);
    if (!isNaN(m) && m < 100 && cost > 0) {
      return cost / (1 - m / 100);
    }
    return null;
  })();

  const targetFromMarkup = (() => {
    const mu = parseFloat(targetMarkupPct);
    if (!isNaN(mu) && cost > 0) {
      return cost * (1 + mu / 100);
    }
    return null;
  })();

  // --- VAT CALCULATIONS ---
  const baseVatVal = parseFloat(vatAmount) || 0;
  let vatNet = 0;
  let vatTax = 0;
  let vatGross = 0;

  if (vatMode === 'exclusive') {
    vatNet = baseVatVal;
    vatTax = baseVatVal * (vatRate / 100);
    vatGross = vatNet + vatTax;
  } else {
    vatGross = baseVatVal;
    vatNet = baseVatVal / (1 + vatRate / 100);
    vatTax = vatGross - vatNet;
  }

  // --- LOAN / EMI CALCULATIONS ---
  const principal = parseFloat(loanPrincipal) || 0;
  const annualRate = parseFloat(loanRateAnnual) || 0;
  const tenure = parseInt(loanTermMonths) || 0;

  const { monthlyEmi, totalInterest, totalPayment, schedule } = (() => {
    if (principal <= 0 || annualRate <= 0 || tenure <= 0) {
      return { monthlyEmi: 0, totalInterest: 0, totalPayment: 0, schedule: [] };
    }
    const r = (annualRate / 100) / 12;
    const emi = (principal * r * Math.pow(1 + r, tenure)) / (Math.pow(1 + r, tenure) - 1);
    const totPay = emi * tenure;
    const totInt = totPay - principal;

    const sched: Array<{ month: number; emi: number; principal: number; interest: number; balance: number }> = [];
    let curBal = principal;
    for (let m = 1; m <= tenure && m <= 60; m++) {
      const intComp = curBal * r;
      const prinComp = emi - intComp;
      curBal = Math.max(0, curBal - prinComp);
      sched.push({
        month: m,
        emi,
        principal: prinComp,
        interest: intComp,
        balance: curBal
      });
    }

    return {
      monthlyEmi: emi,
      totalInterest: totInt,
      totalPayment: totPay,
      schedule: sched
    };
  })();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] pointer-events-auto transition-opacity" 
      />

      {/* Floating Drawer Container */}
      <aside 
        className="absolute top-0 right-0 bottom-0 w-full max-w-md bg-white dark:bg-zinc-900 border-l border-slate-200 dark:border-zinc-800 shadow-2xl flex flex-col pointer-events-auto z-10 animate-in slide-in-from-right duration-200"
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50/70 dark:bg-zinc-900/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shadow-sm">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Calculator & Business Math
              </h2>
              <span className="text-[11px] text-slate-500 font-mono">
                Scientific · Margins · VAT · Loans
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 dark:hover:text-zinc-200 transition"
            title="Close Drawer (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-4 py-2 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-800 rounded-lg">
            <button
              onClick={() => setActiveTab('scientific')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'scientific'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              Scientific
            </button>
            <button
              onClick={() => setActiveTab('margin')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'margin'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Margins
            </button>
            <button
              onClick={() => setActiveTab('vat')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'vat'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              VAT
            </button>
            <button
              onClick={() => setActiveTab('loan')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'loan'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              <Landmark className="w-3.5 h-3.5" />
              Loans
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TAB 1: SCIENTIFIC */}
          {activeTab === 'scientific' && (
            <div className="space-y-3">
              {/* Calculator Screen */}
              <div className="bg-slate-950 text-white rounded-xl p-3.5 shadow-inner border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsRad(!isRad)}
                      className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-300 hover:bg-slate-700"
                    >
                      {isRad ? 'RAD' : 'DEG'}
                    </button>
                    {memory !== 0 && (
                      <span className="text-amber-400 text-[10px] font-bold">M</span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
                  >
                    <History className="w-3 h-3" />
                    History
                  </button>
                </div>
                
                {/* Expression Formula */}
                <div className="h-5 text-right text-xs text-slate-400 font-mono overflow-x-auto truncate">
                  {expression || ' '}
                </div>

                {/* Primary Result Display */}
                <div className="text-right text-2xl font-bold font-mono tracking-tight tabular-nums text-emerald-400 overflow-x-auto">
                  {display}
                </div>
              </div>

              {/* Action bar for Copy & Apply */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(display, 'calc')}
                  className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-zinc-200 transition flex items-center justify-center gap-1.5"
                >
                  {copied === 'calc' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied === 'calc' ? 'Copied!' : 'Copy Result'}
                </button>
                {onApplyValue && !isNaN(parseFloat(display)) && (
                  <button
                    onClick={() => onApplyValue(parseFloat(display))}
                    className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    Apply to Active
                  </button>
                )}
              </div>

              {/* History Drawer Toggle */}
              {showHistory && (
                <div className="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700 space-y-2 max-h-48 overflow-y-auto">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-zinc-300">
                    <span>Recent Calculations</span>
                    <button
                      onClick={() => setHistory([])}
                      className="text-[10px] text-red-500 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                  {history.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No history yet</p>
                  ) : (
                    <div className="space-y-1.5">
                      {history.map(item => (
                        <div
                          key={item.id}
                          onClick={() => { setDisplay(item.result); setShowHistory(false); }}
                          className="p-1.5 bg-white dark:bg-zinc-900 rounded border border-slate-100 dark:border-zinc-800 hover:border-indigo-400 cursor-pointer flex items-center justify-between text-xs font-mono"
                        >
                          <span className="text-slate-500 truncate max-w-[180px]">{item.expression} =</span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">{item.result}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Scientific Keypad */}
              <div className="grid grid-cols-5 gap-1.5 text-xs font-mono">
                {/* Row 1: Memory */}
                <button
                  onClick={() => setMemory(0)}
                  className="p-2 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold"
                >
                  MC
                </button>
                <button
                  onClick={() => {
                    setDisplay(memory.toString());
                    setIsNewCalculation(true);
                  }}
                  className="p-2 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold"
                >
                  MR
                </button>
                <button
                  onClick={() => setMemory(prev => prev + (parseFloat(display) || 0))}
                  className="p-2 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold"
                >
                  M+
                </button>
                <button
                  onClick={() => setMemory(prev => prev - (parseFloat(display) || 0))}
                  className="p-2 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold"
                >
                  M-
                </button>
                <button
                  onClick={handleBackspace}
                  className="p-2 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 hover:bg-rose-100 font-semibold"
                  title="Backspace"
                >
                  ⌫
                </button>

                {/* Row 2: Trig & Constants */}
                <button
                  onClick={() => handleScientificFunction('sin')}
                  className="p-2 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-indigo-600 dark:text-indigo-400 font-semibold"
                >
                  sin
                </button>
                <button
                  onClick={() => handleScientificFunction('cos')}
                  className="p-2 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-indigo-600 dark:text-indigo-400 font-semibold"
                >
                  cos
                </button>
                <button
                  onClick={() => handleScientificFunction('tan')}
                  className="p-2 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-indigo-600 dark:text-indigo-400 font-semibold"
                >
                  tan
                </button>
                <button
                  onClick={() => handleScientificFunction('pi')}
                  className="p-2 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-indigo-600 dark:text-indigo-400 font-semibold"
                >
                  π
                </button>
                <button
                  onClick={() => handleScientificFunction('e')}
                  className="p-2 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-indigo-600 dark:text-indigo-400 font-semibold"
                >
                  e
                </button>

                {/* Row 3: Math ops */}
                <button
                  onClick={() => handleScientificFunction('sqrt')}
                  className="p-2 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold"
                >
                  √x
                </button>
                <button
                  onClick={() => handleScientificFunction('sqr')}
                  className="p-2 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold"
                >
                  x²
                </button>
                <button
                  onClick={() => handleOperator('^')}
                  className="p-2 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold"
                >
                  xʸ
                </button>
                <button
                  onClick={() => handleScientificFunction('log')}
                  className="p-2 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold"
                >
                  log
                </button>
                <button
                  onClick={() => handleScientificFunction('ln')}
                  className="p-2 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold"
                >
                  ln
                </button>

                {/* Row 4: Brackets & Clear */}
                <button
                  onClick={() => handleBracket('(')}
                  className="p-2 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold"
                >
                  (
                </button>
                <button
                  onClick={() => handleBracket(')')}
                  className="p-2 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold"
                >
                  )
                </button>
                <button
                  onClick={handleClearEntry}
                  className="p-2 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 hover:bg-amber-100 font-semibold"
                >
                  CE
                </button>
                <button
                  onClick={handleClear}
                  className="p-2 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 hover:bg-amber-200 font-bold"
                >
                  C
                </button>
                <button
                  onClick={() => handleOperator('÷')}
                  className="p-2 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 font-bold text-sm"
                >
                  ÷
                </button>

                {/* Row 5: 7 8 9 × */}
                <button
                  onClick={() => handleScientificFunction('inv')}
                  className="p-2 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold"
                >
                  1/x
                </button>
                <button
                  onClick={() => handleDigit('7')}
                  className="p-2.5 rounded bg-white dark:bg-zinc-800 hover:bg-slate-50 border border-slate-200 dark:border-zinc-700 font-bold text-sm text-slate-900 dark:text-white"
                >
                  7
                </button>
                <button
                  onClick={() => handleDigit('8')}
                  className="p-2.5 rounded bg-white dark:bg-zinc-800 hover:bg-slate-50 border border-slate-200 dark:border-zinc-700 font-bold text-sm text-slate-900 dark:text-white"
                >
                  8
                </button>
                <button
                  onClick={() => handleDigit('9')}
                  className="p-2.5 rounded bg-white dark:bg-zinc-800 hover:bg-slate-50 border border-slate-200 dark:border-zinc-700 font-bold text-sm text-slate-900 dark:text-white"
                >
                  9
                </button>
                <button
                  onClick={() => handleOperator('×')}
                  className="p-2 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 font-bold text-sm"
                >
                  ×
                </button>

                {/* Row 6: 4 5 6 - */}
                <button
                  onClick={handlePercentage}
                  className="p-2 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold"
                >
                  %
                </button>
                <button
                  onClick={() => handleDigit('4')}
                  className="p-2.5 rounded bg-white dark:bg-zinc-800 hover:bg-slate-50 border border-slate-200 dark:border-zinc-700 font-bold text-sm text-slate-900 dark:text-white"
                >
                  4
                </button>
                <button
                  onClick={() => handleDigit('5')}
                  className="p-2.5 rounded bg-white dark:bg-zinc-800 hover:bg-slate-50 border border-slate-200 dark:border-zinc-700 font-bold text-sm text-slate-900 dark:text-white"
                >
                  5
                </button>
                <button
                  onClick={() => handleDigit('6')}
                  className="p-2.5 rounded bg-white dark:bg-zinc-800 hover:bg-slate-50 border border-slate-200 dark:border-zinc-700 font-bold text-sm text-slate-900 dark:text-white"
                >
                  6
                </button>
                <button
                  onClick={() => handleOperator('-')}
                  className="p-2 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 font-bold text-sm"
                >
                  -
                </button>

                {/* Row 7: 1 2 3 + */}
                <button
                  onClick={() => handleScientificFunction('fact')}
                  className="p-2 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold"
                >
                  n!
                </button>
                <button
                  onClick={() => handleDigit('1')}
                  className="p-2.5 rounded bg-white dark:bg-zinc-800 hover:bg-slate-50 border border-slate-200 dark:border-zinc-700 font-bold text-sm text-slate-900 dark:text-white"
                >
                  1
                </button>
                <button
                  onClick={() => handleDigit('2')}
                  className="p-2.5 rounded bg-white dark:bg-zinc-800 hover:bg-slate-50 border border-slate-200 dark:border-zinc-700 font-bold text-sm text-slate-900 dark:text-white"
                >
                  2
                </button>
                <button
                  onClick={() => handleDigit('3')}
                  className="p-2.5 rounded bg-white dark:bg-zinc-800 hover:bg-slate-50 border border-slate-200 dark:border-zinc-700 font-bold text-sm text-slate-900 dark:text-white"
                >
                  3
                </button>
                <button
                  onClick={() => handleOperator('+')}
                  className="p-2 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 font-bold text-sm"
                >
                  +
                </button>

                {/* Row 8: ± 0 . = */}
                <button
                  onClick={handleSignToggle}
                  className="p-2.5 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold"
                >
                  ±
                </button>
                <button
                  onClick={() => handleDigit('0')}
                  className="col-span-2 p-2.5 rounded bg-white dark:bg-zinc-800 hover:bg-slate-50 border border-slate-200 dark:border-zinc-700 font-bold text-sm text-slate-900 dark:text-white text-center"
                >
                  0
                </button>
                <button
                  onClick={handleDecimal}
                  className="p-2.5 rounded bg-white dark:bg-zinc-800 hover:bg-slate-50 border border-slate-200 dark:border-zinc-700 font-bold text-sm text-slate-900 dark:text-white"
                >
                  .
                </button>
                <button
                  onClick={handleEvaluate}
                  className="p-2.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-sm"
                >
                  =
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: MARGIN & MARKUP */}
          {activeTab === 'margin' && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-zinc-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 space-y-3">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Commercial Margin & Markup Analyzer
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                      Cost Price ({defaultCurrency})
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-zinc-900 font-mono outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                      Selling Price ({defaultCurrency})
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={sellPrice}
                      onChange={(e) => setSellPrice(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-zinc-900 font-mono outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Results Card */}
                {cost > 0 && sell > 0 && (
                  <div className={`p-3 rounded-lg border space-y-2 ${
                    profit >= 0 
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-950 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 text-rose-950 dark:text-rose-300'
                  }`}>
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>Profit per Unit:</span>
                      <span className="font-mono font-bold text-sm">
                        {profit >= 0 ? '+' : ''}{profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {defaultCurrency}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/40">
                      <div className="bg-white dark:bg-zinc-900 p-2 rounded border border-slate-200 dark:border-zinc-700">
                        <span className="text-[10px] text-slate-500 block">Gross Margin %</span>
                        <span className="text-base font-bold font-mono text-indigo-600 dark:text-indigo-400">
                          {marginPct.toFixed(2)}%
                        </span>
                        <span className="text-[9px] text-slate-400 block">of revenue</span>
                      </div>

                      <div className="bg-white dark:bg-zinc-900 p-2 rounded border border-slate-200 dark:border-zinc-700">
                        <span className="text-[10px] text-slate-500 block">Markup %</span>
                        <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          {markupPct.toFixed(2)}%
                        </span>
                        <span className="text-[9px] text-slate-400 block">over cost</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Target Price Solvers */}
              <div className="border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 space-y-3 bg-white dark:bg-zinc-900">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  Target Selling Price Solvers
                </span>

                {/* Target Margin Solver */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                    Desired Profit Margin %:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 25"
                      value={targetMarginPct}
                      onChange={(e) => setTargetMarginPct(e.target.value)}
                      className="w-24 px-2.5 py-1.5 border rounded-lg text-xs bg-white dark:bg-zinc-900 font-mono outline-none focus:border-indigo-500"
                    />
                    {targetFromMargin !== null && (
                      <div className="flex-1 flex items-center justify-between bg-indigo-50 dark:bg-indigo-950/30 px-3 py-1.5 rounded-lg border border-indigo-100 text-xs">
                        <span className="text-slate-600 dark:text-zinc-400 font-medium">Sell Price:</span>
                        <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300">
                          {targetFromMargin.toFixed(2)} {defaultCurrency}
                        </span>
                        <button
                          onClick={() => copyToClipboard(targetFromMargin.toFixed(2), 'targetM')}
                          className="p-1 rounded text-indigo-600 hover:bg-indigo-100"
                          title="Copy"
                        >
                          {copied === 'targetM' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Target Markup Solver */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                    Desired Markup %:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 35"
                      value={targetMarkupPct}
                      onChange={(e) => setTargetMarkupPct(e.target.value)}
                      className="w-24 px-2.5 py-1.5 border rounded-lg text-xs bg-white dark:bg-zinc-900 font-mono outline-none focus:border-indigo-500"
                    />
                    {targetFromMarkup !== null && (
                      <div className="flex-1 flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-lg border border-emerald-100 text-xs">
                        <span className="text-slate-600 dark:text-zinc-400 font-medium">Sell Price:</span>
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                          {targetFromMarkup.toFixed(2)} {defaultCurrency}
                        </span>
                        <button
                          onClick={() => copyToClipboard(targetFromMarkup.toFixed(2), 'targetMu')}
                          className="p-1 rounded text-emerald-600 hover:bg-emerald-100"
                          title="Copy"
                        >
                          {copied === 'targetMu' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: VAT / TAX */}
          {activeTab === 'vat' && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-zinc-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 space-y-3">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Value Added Tax (VAT) & Sales Tax Calculator
                </span>

                {/* Mode toggle */}
                <div className="flex items-center gap-1 p-1 bg-white dark:bg-zinc-900 border rounded-lg text-xs font-semibold">
                  <button
                    onClick={() => setVatMode('exclusive')}
                    className={`flex-1 py-1.5 rounded-md transition ${
                      vatMode === 'exclusive' 
                        ? 'bg-indigo-600 text-white shadow-2xs' 
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                    }`}
                  >
                    Tax Exclusive (Add Tax)
                  </button>
                  <button
                    onClick={() => setVatMode('inclusive')}
                    className={`flex-1 py-1.5 rounded-md transition ${
                      vatMode === 'inclusive' 
                        ? 'bg-indigo-600 text-white shadow-2xs' 
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                    }`}
                  >
                    Tax Inclusive (Extract Tax)
                  </button>
                </div>

                {/* Amount Input */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                    {vatMode === 'exclusive' ? 'Net Amount' : 'Gross Amount'} ({defaultCurrency})
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={vatAmount}
                    onChange={(e) => setVatAmount(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-zinc-900 font-mono outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Quick Tax Rate Presets */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                    Tax Rate %:
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[18, 16, 15, 5, 0].map(rate => (
                      <button
                        key={rate}
                        onClick={() => setVatRate(rate)}
                        className={`px-3 py-1 rounded-md text-xs font-mono font-bold border transition ${
                          vatRate === rate
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {rate}% {rate === 18 ? '(TRA)' : ''}
                      </button>
                    ))}
                    <div className="flex items-center gap-1 ml-auto">
                      <input
                        type="number"
                        step="any"
                        value={vatRate}
                        onChange={(e) => setVatRate(parseFloat(e.target.value) || 0)}
                        className="w-16 px-2 py-1 border rounded-md text-xs font-mono text-center outline-none bg-white dark:bg-zinc-900"
                      />
                      <span className="text-xs text-slate-500">%</span>
                    </div>
                  </div>
                </div>

                {/* Calculation Breakdown Card */}
                {baseVatVal > 0 && (
                  <div className="bg-white dark:bg-zinc-900 rounded-lg p-3.5 border border-slate-200 dark:border-zinc-700 space-y-2.5">
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400">
                      <span>Net Amount (Before Tax):</span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">
                        {vatNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {defaultCurrency}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-400">
                      <span>VAT ({vatRate}%):</span>
                      <span className="font-mono font-bold">
                        +{vatTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {defaultCurrency}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-100 dark:border-zinc-800">
                      <span>Gross Total:</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">
                        {vatGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {defaultCurrency}
                      </span>
                    </div>

                    <div className="pt-2 flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(vatGross.toFixed(2), 'vatGross')}
                        className="flex-1 py-1 px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 rounded text-xs font-semibold text-slate-700 dark:text-zinc-200 transition flex items-center justify-center gap-1"
                      >
                        {copied === 'vatGross' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        Copy Total
                      </button>
                      {onApplyValue && (
                        <button
                          onClick={() => onApplyValue(vatGross)}
                          className="flex-1 py-1 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold transition flex items-center justify-center gap-1"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          Apply Total
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: LOAN / EMI */}
          {activeTab === 'loan' && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-zinc-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 space-y-3">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Loan & Equipment Lease Amortization
                </span>

                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                      Loan Principal ({defaultCurrency})
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 5000000"
                      value={loanPrincipal}
                      onChange={(e) => setLoanPrincipal(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-zinc-900 font-mono outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                        Annual Interest %
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="15"
                        value={loanRateAnnual}
                        onChange={(e) => setLoanRateAnnual(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-zinc-900 font-mono outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                        Tenure (Months)
                      </label>
                      <input
                        type="number"
                        step="1"
                        placeholder="12"
                        value={loanTermMonths}
                        onChange={(e) => setLoanTermMonths(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-zinc-900 font-mono outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Loan Summary */}
                {monthlyEmi > 0 && (
                  <div className="bg-white dark:bg-zinc-900 rounded-lg p-3.5 border border-slate-200 dark:border-zinc-700 space-y-2.5">
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400">
                      <span>Monthly Payment (EMI):</span>
                      <span className="font-mono text-base font-bold text-indigo-600 dark:text-indigo-400">
                        {monthlyEmi.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {defaultCurrency}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400">
                      <span>Total Interest:</span>
                      <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                        {totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {defaultCurrency}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-100 dark:border-zinc-800">
                      <span>Total Payable:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {totalPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {defaultCurrency}
                      </span>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={() => setShowAmortization(!showAmortization)}
                        className="w-full py-1.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-zinc-300 transition"
                      >
                        {showAmortization ? 'Hide Amortization Schedule' : 'View Monthly Schedule'}
                      </button>
                    </div>

                    {/* Schedule Table */}
                    {showAmortization && (
                      <div className="pt-2 max-h-48 overflow-y-auto">
                        <table className="w-full text-[11px] font-mono text-left">
                          <thead className="bg-slate-50 dark:bg-zinc-800 border-b text-[10px] uppercase text-slate-500">
                            <tr>
                              <th className="px-2 py-1">Mo</th>
                              <th className="px-2 py-1">Prin</th>
                              <th className="px-2 py-1">Int</th>
                              <th className="px-2 py-1 text-right">Bal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                            {schedule.map(row => (
                              <tr key={row.month} className="hover:bg-slate-50/50">
                                <td className="px-2 py-1 font-semibold">{row.month}</td>
                                <td className="px-2 py-1">{row.principal.toFixed(0)}</td>
                                <td className="px-2 py-1 text-rose-500">{row.interest.toFixed(0)}</td>
                                <td className="px-2 py-1 text-right font-bold">{row.balance.toFixed(0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/70 flex items-center justify-between text-[11px] text-slate-500">
          <span>Shortcuts: <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-zinc-800 rounded font-mono text-[10px]">Ctrl+Alt+C</kbd> toggle</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-md font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      </aside>
    </div>
  );
};
