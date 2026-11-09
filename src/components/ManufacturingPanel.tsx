import React, { useState, useMemo, useEffect } from 'react';
import {
  Factory, Plus, Trash2, Edit, Edit3, CheckCircle, AlertTriangle, AlertCircle,
  RefreshCw, Printer, QrCode, Search, Layers, FileText, Check, X,
  ShieldCheck, Beaker, Scale, Award, ChevronRight, Eye, Droplets,
  TrendingUp, Sliders, CheckSquare, CornerDownRight, Percent, Building2,
  Clock, History, ShieldAlert, Lock, Unlock, Copy, Sparkles, Filter, ArrowRight
} from 'lucide-react';
import {
  BOM, BomItem, BomOutput, ProductionRun, ProductionRunOutputActual,
  ProductionRunStatus, QCTemplate, QCTemplateParameter, BatchQCCheck, QCLabResult,
  StockItem, Store, Company, User, CostAllocationMethod, ManufacturingSettings,
  ProductionAuditLog
} from '../types';
import { formatMoney } from '../utils/format';
import { generateQrDataUrl } from '../utils/qrCodeUtils';
import { toast } from '../utils/toast';
import { ConfirmActionModal } from './ConfirmActionModal';

interface ManufacturingPanelProps {
  boms: BOM[];
  productionRuns: ProductionRun[];
  qcTemplates: QCTemplate[];
  qcChecks: BatchQCCheck[];
  productionAuditLogs?: ProductionAuditLog[];
  stockItems: StockItem[];
  stores: Store[];
  companies: Company[];
  currentUser: User | null;
  currentCompanyId: string | number | null;
  currentStoreId: string | number | null;
  activeCurrency: string;
  activeExchangeRate: number;
  manufacturingSettings?: ManufacturingSettings;
  rolePermissions?: Record<string, string[]>;
  onSaveBOMs: (boms: BOM[]) => void;
  onSaveProductionRuns: (runs: ProductionRun[]) => void;
  onSaveQCTemplates: (templates: QCTemplate[]) => void;
  onSaveQCChecks: (checks: BatchQCCheck[]) => void;
  onSaveProductionAuditLogs?: (logs: ProductionAuditLog[]) => void;
  onCompleteBatchStock: (run: ProductionRun) => void;
  onDeductBatchStartStock?: (run: ProductionRun) => void;
  logAction?: (action: string, details: string) => void;
  t: (text: string) => string;
}

type TabKey = 'overview' | 'boms' | 'runs' | 'qc' | 'muv' | 'traveler';

const safeNumValue = (v: any): number | string => {
  if (v === undefined || v === null || v === '') return '';
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : '';
};

export default function ManufacturingPanel({
  boms = [],
  productionRuns = [],
  qcTemplates = [],
  qcChecks = [],
  productionAuditLogs = [],
  stockItems = [],
  stores = [],
  companies = [],
  currentUser,
  currentCompanyId,
  currentStoreId,
  activeCurrency,
  activeExchangeRate,
  manufacturingSettings,
  rolePermissions,
  onSaveBOMs,
  onSaveProductionRuns,
  onSaveQCTemplates,
  onSaveQCChecks,
  onSaveProductionAuditLogs,
  onCompleteBatchStock,
  onDeductBatchStartStock,
  logAction,
  t
}: ManufacturingPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // RBAC Permission Check:
  // "MAKE ONLY ADMIN HAD ABILITY TO PERFORM CRUDs ACTION IN MANUFACTURING PANEL, THE BRANCH ADMIN UNLESS HE/SHE GIVEN ACCESS FROM ADMIN OF THE COMPANY."
  const isCompanyAdmin = useMemo(() => {
    if (!currentUser) return false;
    const r = (currentUser.role || '').toLowerCase();
    return r === 'admin' || r === 'super admin' || (currentUser as any)?.isRoot === true;
  }, [currentUser]);

  const hasBranchAdminAccess = useMemo(() => {
    if (!currentUser) return false;
    if ((currentUser as any)?.canManageManufacturing === true) return true;
    const userRole = currentUser.role || '';
    const permissionsForRole = rolePermissions?.[userRole] || [];
    if (permissionsForRole.includes('manufacturing-manage') || permissionsForRole.includes('manufacturing')) return true;
    const userDirectPermissions = (currentUser as any)?.permissions || [];
    return userDirectPermissions.includes('manufacturing-manage');
  }, [currentUser, rolePermissions]);

  const canPerformCRUD = isCompanyAdmin || hasBranchAdminAccess;

  // Active Company Object
  const activeCompany = useMemo(() => {
    return companies.find(c => String(c.id) === String(currentCompanyId)) || companies[0];
  }, [companies, currentCompanyId]);

  // Filtered by company context
  const companyBoms = useMemo(() => {
    return boms.filter(b => !currentCompanyId || String(b.companyId) === String(currentCompanyId));
  }, [boms, currentCompanyId]);

  const companyRuns = useMemo(() => {
    return productionRuns.filter(r => !currentCompanyId || String(r.companyId) === String(currentCompanyId));
  }, [productionRuns, currentCompanyId]);

  const companyTemplates = useMemo(() => {
    return qcTemplates.filter(t => !currentCompanyId || String(t.companyId) === String(currentCompanyId));
  }, [qcTemplates, currentCompanyId]);

  const companyQcChecks = useMemo(() => {
    const runIds = new Set(companyRuns.map(r => String(r.id)));
    return qcChecks.filter(c => runIds.has(String(c.runId)));
  }, [qcChecks, companyRuns]);

  const companyAuditLogs = useMemo(() => {
    const runIds = new Set(companyRuns.map(r => String(r.id)));
    return (productionAuditLogs || []).filter(l => 
      runIds.has(String(l.runId)) || (!currentCompanyId || String(l.companyId) === String(currentCompanyId))
    );
  }, [productionAuditLogs, companyRuns, currentCompanyId]);

  // Helper to record an audit log entry for production orders
  const appendAuditLog = (
    runId: string | number,
    batchNumber: string,
    actionType: ProductionAuditLog['actionType'],
    title: string,
    description: string,
    details?: Record<string, any>
  ) => {
    const newLog: ProductionAuditLog = {
      id: `PAL-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      runId,
      batchNumber,
      companyId: currentCompanyId,
      actionType,
      title,
      description,
      performedBy: currentUser?.name || currentUser?.username || 'System Administrator',
      userRole: currentUser?.role || 'Company Admin',
      timestamp: new Date().toISOString(),
      details
    };
    if (onSaveProductionAuditLogs) {
      onSaveProductionAuditLogs([newLog, ...(productionAuditLogs || [])]);
    }
  };

  // Settings thresholds
  const invisibleThreshold = manufacturingSettings?.flourInvisibleLossThreshold ?? 3.0; // 3%
  const warningInvisibleThreshold = manufacturingSettings?.warningInvisibleLossThreshold ?? 5.0; // 5%

  // --------------------------------------------------------------------------
  // STATE: Modals & Editors
  // --------------------------------------------------------------------------
  // 1. BOM Editor Modal
  const [showBomModal, setShowBomModal] = useState(false);
  const [editingBomId, setEditingBomId] = useState<string | number | null>(null);
  const [bomName, setBomName] = useState('');
  const [bomCode, setBomCode] = useState('');
  const [bomCategory, setBomCategory] = useState('Grain Milling');
  const [bomBaseQty, setBomBaseQty] = useState<number>(1000);
  const [bomAllocationMethod, setBomAllocationMethod] = useState<CostAllocationMethod>('by_market_value');
  const [bomRawItems, setBomRawItems] = useState<BomItem[]>([]);
  const [bomOutputs, setBomOutputs] = useState<BomOutput[]>([]);
  const [bomPackagingCost, setBomPackagingCost] = useState<number>(0);
  const [bomLaborCost, setBomLaborCost] = useState<number>(0);
  const [bomOverheadCost, setBomOverheadCost] = useState<number>(0);

  // 2. Production Run Creation Modal
  const [showCreateRunModal, setShowCreateRunModal] = useState(false);
  const [runBomId, setRunBomId] = useState<string | number>('');
  const [runStoreId, setRunStoreId] = useState<number>(Number(currentStoreId) || (stores[0]?.id ? Number(stores[0].id) : 1));
  const [runBatchNumber, setRunBatchNumber] = useState('');
  const [runInputWeightKg, setRunInputWeightKg] = useState<number>(1000);
  const [runPlannedDate, setRunPlannedDate] = useState(new Date().toISOString().split('T')[0]);
  const [runExpiryDate, setRunExpiryDate] = useState('');
  const [runNotes, setRunNotes] = useState('');
  const [runStartImmediately, setRunStartImmediately] = useState<boolean>(true);

  // Status Filter for Production Runs Table
  const [runStatusFilter, setRunStatusFilter] = useState<'all' | 'work_available' | 'Planned' | 'In-Progress' | 'Quality Check' | 'Completed'>('all');

  // Confirmation Modal State (replaces window.confirm in iframe)
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmText: 'Delete',
    cancelText: 'Cancel',
    onConfirm: () => {}
  });

  // 3. Live Batch Runner Modal / Drawer
  const [activeRunnerRun, setActiveRunnerRun] = useState<ProductionRun | null>(null);
  const [runnerCleaningLoss, setRunnerCleaningLoss] = useState<number>(0);
  const [runnerMillingScrap, setRunnerMillingScrap] = useState<number>(0);
  const [runnerMoistureBefore, setRunnerMoistureBefore] = useState<number>(13.5);
  const [runnerMoistureAfter, setRunnerMoistureAfter] = useState<number>(12.0);
  const [runnerOutputActuals, setRunnerOutputActuals] = useState<Record<number, number>>({});

  // 4. QC Testing Modal
  const [activeQCRun, setActiveQCRun] = useState<ProductionRun | null>(null);
  const [qcTemplateId, setQcTemplateId] = useState<string | number>('');
  const [qcLabInputs, setQcLabInputs] = useState<Record<string | number, number>>({});
  const [qcIsOverridden, setQcIsOverridden] = useState(false);
  const [qcOverrideDecision, setQcOverrideDecision] = useState<'Passed' | 'Passed with Variance' | 'Rework Required' | 'Rejected'>('Passed');
  const [qcOverrideReason, setQcOverrideReason] = useState('');
  const [qcInspectorName, setQcInspectorName] = useState(currentUser?.name || currentUser?.username || 'QC Lab Inspector');
  const [qcSignature, setQcSignature] = useState('APPROVED - ' + (currentUser?.username || 'ADMIN'));

  // 5. QC Template Editor Modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | number | null>(null);
  const [tmplName, setTmplName] = useState('');
  const [tmplCategory, setTmplCategory] = useState('Grain Milling');
  const [tmplStandardRef, setTmplStandardRef] = useState('TZS 438:2021 / EAS 44');
  const [tmplParameters, setTmplParameters] = useState<Array<{
    id: string;
    paramName: string;
    unit: string;
    minValue?: number;
    maxValue?: number;
    targetValue?: number;
    isCritical: boolean;
  }>>([
    { id: 'p-1', paramName: 'Moisture Content', unit: '%', minValue: 10.0, maxValue: 13.5, isCritical: true },
    { id: 'p-2', paramName: 'Protein (Dry Basis)', unit: '%', minValue: 10.0, maxValue: 16.0, isCritical: true },
    { id: 'p-3', paramName: 'Total Ash Content', unit: '%', minValue: 0.0, maxValue: 0.8, isCritical: false },
    { id: 'p-4', paramName: 'Whiteness (L* Index)', unit: 'index', minValue: 90.0, maxValue: 100.0, isCritical: false },
    { id: 'p-5', paramName: 'Sieve Retention (> 212µm)', unit: '%', minValue: 0.0, maxValue: 2.0, isCritical: false }
  ]);

  // 6. Traceability Traveler Modal
  const [travelerRun, setTravelerRun] = useState<ProductionRun | null>(null);
  const [travelerQrUrl, setTravelerQrUrl] = useState<string>('');

  // 7. Production Order Audit Trail Timeline Modal
  const [activeAuditRun, setActiveAuditRun] = useState<ProductionRun | null>(null);
  const [auditFilterType, setAuditFilterType] = useState<string>('ALL');

  // --------------------------------------------------------------------------
  // KPI CALCULATIONS FOR PRODUCTION OVERVIEW
  // --------------------------------------------------------------------------
  const overviewStats = useMemo(() => {
    const totalRuns = companyRuns.length;
    const completedRuns = companyRuns.filter(r => r.status === 'Completed');
    const inProgressRuns = companyRuns.filter(r => r.status === 'In-Progress');
    const plannedRuns = companyRuns.filter(r => r.status === 'Planned');
    const qcRuns = companyRuns.filter(r => r.status === 'Quality Check');

    const totalRawWeighedKg = completedRuns.reduce((sum, r) => sum + (r.inputWeightKg || 0), 0);
    const totalOutputProducedKg = completedRuns.reduce((sum, r) => sum + (r.totalOutputKg || 0), 0);
    const totalCleaningLossKg = completedRuns.reduce((sum, r) => sum + (r.cleaningLossKg || 0), 0);
    const totalInvisibleLossKg = completedRuns.reduce((sum, r) => sum + (r.invisibleLossKg || 0), 0);
    const totalBatchCost = completedRuns.reduce((sum, r) => sum + (r.totalBatchCost || 0), 0);

    const overallYieldPct = totalRawWeighedKg > 0 ? (totalOutputProducedKg / totalRawWeighedKg) * 100 : 95.5;
    const avgInvisibleLossPct = totalRawWeighedKg > 0 ? (totalInvisibleLossKg / totalRawWeighedKg) * 100 : 1.78;

    const passedQcCount = companyQcChecks.filter(c => c.finalDecision === 'Passed' || c.finalDecision === 'Passed with Variance').length;
    const qcPassRate = companyQcChecks.length > 0 ? (passedQcCount / companyQcChecks.length) * 100 : 100;

    return {
      totalRuns,
      completedRuns: completedRuns.length,
      inProgressRuns: inProgressRuns.length,
      plannedRuns: plannedRuns.length,
      qcRuns: qcRuns.length,
      totalRawWeighedKg,
      totalOutputProducedKg,
      totalCleaningLossKg,
      totalInvisibleLossKg,
      totalBatchCost,
      overallYieldPct,
      avgInvisibleLossPct,
      qcPassRate
    };
  }, [companyRuns, companyQcChecks]);

  // Dynamic BOM warehouse parts stock status & in-flight batch count
  const bomStockStatus = useMemo(() => {
    const statusMap: Record<string | number, {
      producibleBatches: number;
      activeBatches: number;
      completedBatches: number;
      missingItems: string[];
    }> = {};

    companyBoms.forEach(bom => {
      const activeBatches = companyRuns.filter(r => String(r.bomId) === String(bom.id) && (r.status === 'In-Progress' || r.status === 'Planned' || r.status === 'Quality Check')).length;
      const completedBatches = companyRuns.filter(r => String(r.bomId) === String(bom.id) && r.status === 'Completed').length;

      const missingItems: string[] = [];
      let minBatches = Infinity;

      if (!bom.items || bom.items.length === 0) {
        minBatches = 0;
      } else {
        bom.items.forEach(item => {
          if (!item.quantity || item.quantity <= 0) return;
          const matchedItem = stockItems.find(p => String(p.id) === String(item.productId) || (item.productName && p.name.toLowerCase() === item.productName.toLowerCase()));
          if (!matchedItem) {
            minBatches = 0;
            missingItems.push(item.productName || 'Raw Material');
            return;
          }
          const storeIdNum = Number(currentStoreId);
          const storeStock = (storeIdNum && matchedItem.stock?.[storeIdNum] !== undefined)
            ? (matchedItem.stock[storeIdNum] || 0)
            : Object.values(matchedItem.stock || {}).reduce((s, v) => s + (Number(v) || 0), 0);

          const possible = Math.floor(storeStock / item.quantity);
          if (possible < minBatches) {
            minBatches = possible;
          }
          if (storeStock < item.quantity) {
            missingItems.push(`${item.productName} (${storeStock}/${item.quantity})`);
          }
        });
      }

      statusMap[bom.id] = {
        producibleBatches: minBatches === Infinity ? 0 : minBatches,
        activeBatches,
        completedBatches,
        missingItems
      };
    });

    return statusMap;
  }, [companyBoms, companyRuns, stockItems, currentStoreId]);

  // Live Work Available counts (Planned + In-Progress + Quality Check)
  const workAvailableRuns = useMemo(() => {
    return companyRuns.filter(r => r.status === 'Planned' || r.status === 'In-Progress' || r.status === 'Quality Check');
  }, [companyRuns]);
  const workAvailableCount = workAvailableRuns.length;

  // Filtered Production Runs for the table view
  const filteredCompanyRuns = useMemo(() => {
    if (runStatusFilter === 'all') return companyRuns;
    if (runStatusFilter === 'work_available') return workAvailableRuns;
    return companyRuns.filter(r => r.status === runStatusFilter);
  }, [companyRuns, runStatusFilter, workAvailableRuns]);

  // --------------------------------------------------------------------------
  // COST ALLOCATION LOGIC (Joint Product / Multi-Output)
  // --------------------------------------------------------------------------
  const calculateOutputCosts = <T extends { productId: number; expectedQtyKg: number; actualQtyKg?: number; marketPrice: number; allocationPercent?: number }>(
    method: CostAllocationMethod,
    totalCost: number,
    outputs: T[]
  ) => {
    const results = outputs.map(out => {
      const qty = out.actualQtyKg !== undefined ? out.actualQtyKg : out.expectedQtyKg;
      return {
        ...out,
        qty,
        totalMarketValue: qty * (out.marketPrice || 0)
      };
    });

    const totalWeight = results.reduce((sum, o) => sum + (o.qty || 0), 0);
    const totalValue = results.reduce((sum, o) => sum + (o.totalMarketValue || 0), 0);

    return results.map(out => {
      let allocatedCost = 0;
      if (method === 'by_weight') {
        const fraction = totalWeight > 0 ? out.qty / totalWeight : 1 / results.length;
        allocatedCost = totalCost * fraction;
      } else if (method === 'by_market_value') {
        const fraction = totalValue > 0 ? out.totalMarketValue / totalValue : (totalWeight > 0 ? out.qty / totalWeight : 1 / results.length);
        allocatedCost = totalCost * fraction;
      } else if (method === 'manual') {
        const pct = out.allocationPercent || 0;
        allocatedCost = totalCost * (pct / 100);
      }
      const unitCost = out.qty > 0 ? allocatedCost / out.qty : 0;
      return {
        ...out,
        allocatedCost,
        unitCost
      };
    });
  };

  // --------------------------------------------------------------------------
  // BOM EDITOR HANDLERS
  // --------------------------------------------------------------------------
  const openNewBomModal = () => {
    setEditingBomId(null);
    setBomName('Wheat Flour Milling 1000kg');
    setBomCode(`BOM-WF-${Math.floor(1000 + Math.random() * 9000)}`);
    setBomCategory('Grain Milling');
    setBomBaseQty(1000);
    setBomAllocationMethod('by_market_value');

    // Default sample wheat raw materials
    const rawWheatItem = stockItems.find(p => p.name.toLowerCase().includes('wheat') || p.name.toLowerCase().includes('ngano')) || stockItems[0];
    setBomRawItems([
      {
        productId: rawWheatItem ? rawWheatItem.id : 1,
        productName: rawWheatItem ? rawWheatItem.name : 'Raw Wheat Grain (Ngano Mbichi)',
        quantity: 1000,
        unitCost: rawWheatItem ? rawWheatItem.purchasePrice : 1200,
        unit: 'kg',
        scrapAllowancePercent: 2.0
      }
    ]);

    // Default sample multi-outputs (2 primary + 1 by-product)
    const p1 = stockItems.find(p => p.name.toLowerCase().includes('flour') || p.name.toLowerCase().includes('unga')) || stockItems[0];
    const p2 = stockItems.find(p => p.id !== p1?.id) || stockItems[1] || stockItems[0];
    const p3 = stockItems.find(p => p.id !== p1?.id && p.id !== p2?.id) || stockItems[2] || stockItems[0];

    setBomOutputs([
      {
        id: 'out-1',
        bomId: '',
        productId: p1?.id || 1,
        productName: p1?.name || 'Wheat Flour Grade 1 (Super)',
        isPrimary: true,
        expectedQtyKg: 650,
        expectedMarketPrice: 2200,
        allocationPercent: 70
      },
      {
        id: 'out-2',
        bomId: '',
        productId: p2?.id || 2,
        productName: p2?.name || 'Wheat Flour Standard (Home Baking)',
        isPrimary: true,
        expectedQtyKg: 150,
        expectedMarketPrice: 1800,
        allocationPercent: 18
      },
      {
        id: 'out-3',
        bomId: '',
        productId: p3?.id || 3,
        productName: p3?.name || 'Wheat Bran (Pumba ya Ngano)',
        isPrimary: false, // By-product!
        expectedQtyKg: 180,
        expectedMarketPrice: 600,
        allocationPercent: 12
      }
    ]);

    setBomPackagingCost(45000);
    setBomLaborCost(30000);
    setBomOverheadCost(25000);
    setShowBomModal(true);
  };

  const openEditBomModal = (bom: BOM) => {
    setEditingBomId(bom.id);
    setBomName(bom.name);
    setBomCode(bom.code);
    setBomCategory(bom.category || 'Grain Milling');
    setBomBaseQty(bom.baseQuantity);
    setBomAllocationMethod(bom.costAllocationMethod || 'by_market_value');
    setBomRawItems(bom.items || []);
    setBomOutputs(bom.outputs || []);
    setBomPackagingCost(bom.packagingCost || 0);
    setBomLaborCost(bom.laborCost || 0);
    setBomOverheadCost(bom.overheadCost || 0);
    setShowBomModal(true);
  };

  const handleSaveBOM = () => {
    if (!bomName.trim() || !bomCode.trim()) {
      toast.error(t('Please provide BOM name and unique recipe code'));
      return;
    }
    if (bomRawItems.length === 0) {
      toast.error(t('Please add at least one raw material'));
      return;
    }
    const hasEmptyRaw = bomRawItems.some(item => !item.productName || !item.productName.trim());
    if (hasEmptyRaw) {
      toast.error(t('Please provide names for all raw material inputs'));
      return;
    }

    if (bomOutputs.length === 0) {
      toast.error(t('Please add at least one expected output product'));
      return;
    }
    const hasEmptyOut = bomOutputs.some(out => !out.productName || !out.productName.trim());
    if (hasEmptyOut) {
      toast.error(t('Please provide names for all output products'));
      return;
    }

    const cleanedRawItems = bomRawItems.map((item, idx) => ({
      ...item,
      productName: item.productName.trim(),
      productId: item.productId || (Date.now() + idx),
      unit: item.unit?.trim() || 'kg'
    }));

    const cleanedOutputs = bomOutputs.map((out, idx) => ({
      ...out,
      productName: out.productName.trim(),
      productId: out.productId || (Date.now() + 100 + idx)
    }));

    const newBom: BOM = {
      id: editingBomId || `BOM-${Date.now()}`,
      companyId: currentCompanyId,
      name: bomName.trim(),
      code: bomCode.trim().toUpperCase(),
      category: bomCategory,
      baseQuantity: Number(bomBaseQty) || 1000,
      costAllocationMethod: bomAllocationMethod,
      items: cleanedRawItems,
      outputs: cleanedOutputs,
      packagingCost: Number(bomPackagingCost) || 0,
      laborCost: Number(bomLaborCost) || 0,
      overheadCost: Number(bomOverheadCost) || 0,
      isActive: true,
      updatedAt: new Date().toISOString()
    };

    let updatedBoms: BOM[];
    if (editingBomId) {
      updatedBoms = boms.map(b => b.id === editingBomId ? newBom : b);
      toast.success(t(`BOM "${newBom.name}" updated successfully`));
    } else {
      newBom.createdAt = new Date().toISOString();
      updatedBoms = [newBom, ...boms];
      toast.success(t(`New Joint Product BOM "${newBom.name}" created`));
    }

    onSaveBOMs(updatedBoms);
    setShowBomModal(false);
  };

  const handleDeleteBOM = (bomId: string | number) => {
    if (!canPerformCRUD) {
      toast.error(t('Only Company Admin has permission to delete BOM recipes.'));
      return;
    }
    const targetBom = boms.find(b => b.id === bomId);
    if (!targetBom) return;

    setConfirmModalState({
      isOpen: true,
      title: t('Delete Bill of Materials Recipe'),
      description: t(`Are you sure you want to delete "${targetBom.name}" (${targetBom.code})? This will permanently remove the BOM recipe.`),
      confirmText: t('Delete Recipe'),
      cancelText: t('Cancel'),
      onConfirm: () => {
        const next = boms.filter(b => b.id !== bomId);
        onSaveBOMs(next);
        toast.success(t(`BOM recipe "${targetBom.name}" deleted successfully`));
        if (logAction) {
          logAction('BOM Recipe Deleted', `Deleted BOM recipe ${targetBom.code} - ${targetBom.name}`);
        }
      }
    });
  };

  // --------------------------------------------------------------------------
  // PRODUCTION RUN CREATION & MANAGEMENT
  // --------------------------------------------------------------------------
  const handleDeleteRun = (runId: string | number) => {
    if (!canPerformCRUD) {
      toast.error(t('Only Company Admin has permission to delete production orders.'));
      return;
    }
    const targetRun = companyRuns.find(r => r.id === runId);
    if (!targetRun) return;

    setConfirmModalState({
      isOpen: true,
      title: t('Delete Production Batch Run'),
      description: t(`Are you sure you want to delete Batch #${targetRun.batchNumber} (${targetRun.runNumber})? This will permanently remove the batch order.`),
      confirmText: t('Delete Order'),
      cancelText: t('Cancel'),
      onConfirm: () => {
        const next = productionRuns.filter(r => r.id !== runId);
        onSaveProductionRuns(next);
        appendAuditLog(
          targetRun.id,
          targetRun.batchNumber,
          'STATUS_CHANGED',
          t('Production Batch Order Deleted'),
          `Production order #${targetRun.batchNumber} was deleted from system.`,
          { deletedRunId: targetRun.id, batchNumber: targetRun.batchNumber }
        );
        toast.success(t(`Production Order #${targetRun.batchNumber} deleted successfully`));
        if (logAction) {
          logAction('Production Run Deleted', `Deleted production run #${targetRun.batchNumber}`);
        }
      }
    });
  };

  const openNewRunModal = (preselectedBomId?: string | number) => {
    const selectedBom = boms.find(b => b.id === preselectedBomId) || companyBoms[0];
    const initialBomId = selectedBom ? selectedBom.id : (boms[0]?.id || '');
    setRunBomId(initialBomId);
    setRunStoreId(Number(currentStoreId) || (stores[0]?.id ? Number(stores[0].id) : 1));
    const codeTag = selectedBom ? selectedBom.code.replace('BOM-', '') : 'PR';
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(100 + Math.random() * 900);
    setRunBatchNumber(`LOT-${codeTag}-${dateStr}-${rand}`);
    setRunInputWeightKg(selectedBom ? selectedBom.baseQuantity : 1000);
    setRunPlannedDate(new Date().toISOString().split('T')[0]);
    const exp = new Date();
    exp.setMonth(exp.getMonth() + 6);
    setRunExpiryDate(exp.toISOString().split('T')[0]);
    setRunNotes('');
    setRunStartImmediately(true);
    setShowCreateRunModal(true);
  };

  const handleCreateProductionRun = () => {
    const bom = boms.find(b => b.id === runBomId);
    if (!bom) {
      toast.error(t('Please select a valid Bill of Materials'));
      return;
    }
    if (!runBatchNumber.trim()) {
      toast.error(t('Batch number is required'));
      return;
    }

    const rawCost = (bom.items || []).reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
    const packaging = bom.packagingCost || 0;
    const labor = bom.laborCost || 0;
    const overhead = bom.overheadCost || 0;
    const totalCost = rawCost + packaging + labor + overhead;

    // Scale output actuals based on input weight
    const scale = runInputWeightKg > 0 && bom.baseQuantity > 0 ? runInputWeightKg / bom.baseQuantity : 1;
    const plannedOutputs: ProductionRunOutputActual[] = (bom.outputs || []).map(out => {
      const expQty = Math.round(out.expectedQtyKg * scale);
      return {
        productId: out.productId,
        productName: out.productName || 'Product',
        isPrimary: out.isPrimary,
        expectedQtyKg: expQty,
        actualQtyKg: expQty, // default to expected, refined during runner
        allocatedCost: 0,
        unitCost: 0,
        marketPrice: out.expectedMarketPrice,
        allocationPercent: out.allocationPercent
      };
    });

    const calculated = calculateOutputCosts(bom.costAllocationMethod, totalCost, plannedOutputs);
    const finalOutputs: ProductionRunOutputActual[] = calculated.map(c => ({
      productId: c.productId,
      productName: c.productName,
      isPrimary: c.isPrimary,
      expectedQtyKg: c.expectedQtyKg,
      actualQtyKg: c.qty,
      allocatedCost: c.allocatedCost,
      unitCost: c.unitCost,
      marketPrice: c.marketPrice,
      allocationPercent: c.allocationPercent
    }));

    const totalOut = finalOutputs.reduce((sum, o) => sum + o.actualQtyKg, 0);
    const runNum = `PR-${new Date().getFullYear()}-${String(companyRuns.length + 101).padStart(4, '0')}`;

    const actualRaw = (bom.items || []).map(item => ({
      productId: item.productId,
      productName: item.productName || 'Raw Material',
      consumedQty: Math.round(item.quantity * scale * 100) / 100,
      standardQty: item.quantity,
      unitCost: item.unitCost
    }));

    const isImmediate = runStartImmediately;
    const initialStatus: ProductionRunStatus = isImmediate ? 'In-Progress' : 'Planned';

    const newRun: ProductionRun = {
      id: `RUN-${Date.now()}`,
      runNumber: runNum,
      batchNumber: runBatchNumber.trim().toUpperCase(),
      bomId: bom.id,
      bomName: bom.name,
      companyId: currentCompanyId,
      storeId: runStoreId,
      status: initialStatus,
      plannedStartDate: runPlannedDate,
      actualStartDate: isImmediate ? new Date().toISOString().split('T')[0] : undefined,
      expiryDate: runExpiryDate,
      notes: runNotes,
      actualRawMaterials: actualRaw,
      rawMaterialsDeducted: isImmediate,
      inputWeightKg: runInputWeightKg,
      cleaningLossKg: 0,
      millingScrapKg: 0,
      invisibleLossKg: 0,
      moistureBeforePercent: 13.5,
      moistureAfterPercent: 12.0,
      rawMaterialCost: rawCost,
      packagingCost: packaging,
      laborCost: labor,
      overheadCost: overhead,
      totalBatchCost: totalCost,
      outputs: finalOutputs,
      totalOutputKg: totalOut,
      yieldPercent: runInputWeightKg > 0 ? (totalOut / runInputWeightKg) * 100 : 96.0,
      qcStatus: 'Pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (isImmediate && onDeductBatchStartStock) {
      onDeductBatchStartStock(newRun);
    }

    const nextRuns = [newRun, ...productionRuns];
    onSaveProductionRuns(nextRuns);
    setShowCreateRunModal(false);

    appendAuditLog(
      newRun.id,
      newRun.batchNumber,
      'BATCH_CREATED',
      isImmediate ? t('Production Batch Started') : t('Production Batch Planned'),
      `${isImmediate ? 'Started' : 'Planned'} batch #${newRun.batchNumber} with BOM ${bom.name} (${runInputWeightKg} kg target input). ${isImmediate ? 'Raw materials deducted from warehouse inventory.' : ''}`,
      {
        bomId: bom.id,
        bomName: bom.name,
        inputWeightKg: runInputWeightKg,
        storeId: runStoreId,
        plannedStartDate: runPlannedDate,
        expiryDate: runExpiryDate,
        rawMaterialsDeducted: isImmediate
      }
    );

    if (logAction) {
      logAction(isImmediate ? 'Production Run Started' : 'Production Run Planned', `${isImmediate ? 'Started' : 'Planned'} batch ${newRun.batchNumber} with BOM ${bom.name} (${runInputWeightKg} kg input).`);
    }

    if (isImmediate) {
      toast.success(t(`Batch #${newRun.batchNumber} launched into In-Progress! Raw material parts decreased in stock.`));
      setActiveTab('runs');
    } else {
      toast.success(t(`Production Order #${newRun.batchNumber} scheduled.`));
    }
  };

  // --------------------------------------------------------------------------
  // LIVE BATCH RUNNER & LOSS ANALYSIS (Enhancement #2)
  // --------------------------------------------------------------------------
  const openBatchRunner = (run: ProductionRun) => {
    // If run was planned and starting now, deduct raw materials and mark in-progress
    if (run.status === 'Planned') {
      const bom = boms.find(b => b.id === run.bomId);
      const scale = run.inputWeightKg > 0 && bom && bom.baseQuantity > 0 ? run.inputWeightKg / bom.baseQuantity : 1;
      const rawMaterials = run.actualRawMaterials && run.actualRawMaterials.length > 0 ? run.actualRawMaterials : (bom?.items || []).map(item => ({
        productId: item.productId,
        productName: item.productName || 'Raw Material',
        consumedQty: Math.round(item.quantity * scale * 100) / 100,
        standardQty: item.quantity,
        unitCost: item.unitCost
      }));

      const startedRun: ProductionRun = {
        ...run,
        status: 'In-Progress',
        actualStartDate: run.actualStartDate || new Date().toISOString().split('T')[0],
        actualRawMaterials: rawMaterials,
        rawMaterialsDeducted: true,
        updatedAt: new Date().toISOString()
      };

      if (!run.rawMaterialsDeducted && onDeductBatchStartStock) {
        onDeductBatchStartStock(startedRun);
      }

      const nextRuns = productionRuns.map(r => r.id === run.id ? startedRun : r);
      onSaveProductionRuns(nextRuns);
      run = startedRun;

      appendAuditLog(
        run.id,
        run.batchNumber,
        'STATUS_CHANGE',
        t('Production Batch Started'),
        `Batch status progressed to In-Progress. Raw materials consumed from warehouse #${run.storeId}.`
      );
      toast.success(t(`Batch #${run.batchNumber} is now In-Progress. Raw material stock deducted.`));
    }

    setActiveRunnerRun(run);
    setRunnerCleaningLoss(run.cleaningLossKg || 12);
    setRunnerMillingScrap(run.millingScrapKg || 10);
    setRunnerMoistureBefore(run.moistureBeforePercent || 13.8);
    setRunnerMoistureAfter(run.moistureAfterPercent || 12.0);

    const actualMap: Record<number, number> = {};
    (run.outputs || []).forEach(out => {
      actualMap[out.productId] = out.actualQtyKg || out.expectedQtyKg;
    });
    setRunnerOutputActuals(actualMap);
  };

  // Live Loss Analysis Calculation
  const runnerLossMetrics = useMemo(() => {
    if (!activeRunnerRun) {
      return { totalOutputsKg: 0, invisibleLossKg: 0, invisibleLossPercent: 0, totalYieldPercent: 0 };
    }
    const inputWeight = Number(activeRunnerRun.inputWeightKg) || 1000;
    const cleaning = Number(runnerCleaningLoss) || 0;
    const scrap = Number(runnerMillingScrap) || 0;

    let totalOutputs = 0;
    (activeRunnerRun.outputs || []).forEach(out => {
      const val = runnerOutputActuals[out.productId];
      totalOutputs += Number(val !== undefined ? val : out.expectedQtyKg) || 0;
    });

    // Formula: invisible_loss_kg = input_weight_kg - (SUM(actual_output_qty_all_products) + cleaning_loss_kg + milling_scrap_kg)
    const invisibleLossKg = Math.max(0, inputWeight - (totalOutputs + cleaning + scrap));
    const invisibleLossPercent = inputWeight > 0 ? (invisibleLossKg / inputWeight) * 100 : 0;
    const totalYieldPercent = inputWeight > 0 ? (totalOutputs / inputWeight) * 100 : 0;

    return {
      totalOutputsKg: totalOutputs,
      invisibleLossKg,
      invisibleLossPercent,
      totalYieldPercent
    };
  }, [activeRunnerRun, runnerCleaningLoss, runnerMillingScrap, runnerOutputActuals]);

  const handleUpdateBatchRunner = (nextStatus?: 'In-Progress' | 'Quality Check') => {
    if (!activeRunnerRun) return;

    const bom = boms.find(b => b.id === activeRunnerRun.bomId);
    const method = bom?.costAllocationMethod || 'by_market_value';

    const updatedOutputsList: ProductionRunOutputActual[] = (activeRunnerRun.outputs || []).map(out => {
      const actualQty = Number(runnerOutputActuals[out.productId]) || out.expectedQtyKg;
      return {
        ...out,
        actualQtyKg: actualQty
      };
    });

    const calculatedOutputs = calculateOutputCosts(
      method,
      activeRunnerRun.totalBatchCost,
      updatedOutputsList
    );

    const finalOutputs: ProductionRunOutputActual[] = calculatedOutputs.map(c => ({
      productId: c.productId,
      productName: c.productName,
      isPrimary: c.isPrimary,
      expectedQtyKg: c.expectedQtyKg,
      actualQtyKg: c.actualQtyKg || c.qty,
      allocatedCost: c.allocatedCost,
      unitCost: c.unitCost,
      marketPrice: c.marketPrice,
      allocationPercent: c.allocationPercent
    }));

    const statusToSet = nextStatus || activeRunnerRun.status;

    const updatedRun: ProductionRun = {
      ...activeRunnerRun,
      status: statusToSet,
      cleaningLossKg: runnerCleaningLoss,
      millingScrapKg: runnerMillingScrap,
      invisibleLossKg: runnerLossMetrics.invisibleLossKg,
      moistureBeforePercent: runnerMoistureBefore,
      moistureAfterPercent: runnerMoistureAfter,
      outputs: finalOutputs,
      totalOutputKg: runnerLossMetrics.totalOutputsKg,
      yieldPercent: runnerLossMetrics.totalYieldPercent,
      actualStartDate: activeRunnerRun.actualStartDate || new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString()
    };

    const nextRuns = productionRuns.map(r => r.id === updatedRun.id ? updatedRun : r);
    onSaveProductionRuns(nextRuns);
    setActiveRunnerRun(updatedRun);

    if (nextStatus && nextStatus !== activeRunnerRun.status) {
      appendAuditLog(
        activeRunnerRun.id,
        activeRunnerRun.batchNumber,
        'STATUS_CHANGE',
        t('Production Stage Progressed'),
        `Batch status changed from ${activeRunnerRun.status} to ${nextStatus}.`,
        { oldStatus: activeRunnerRun.status, newStatus: nextStatus }
      );
    }

    appendAuditLog(
      activeRunnerRun.id,
      activeRunnerRun.batchNumber,
      'MATERIAL_USAGE',
      t('Material Usage & Loss Analysis Adjusted'),
      `Cleaning loss: ${runnerCleaningLoss} kg, Milling scrap: ${runnerMillingScrap} kg, Invisible loss: ${runnerLossMetrics.invisibleLossKg} kg (${runnerLossMetrics.invisibleLossPercent.toFixed(1)}%).`,
      {
        cleaningLossKg: runnerCleaningLoss,
        millingScrapKg: runnerMillingScrap,
        invisibleLossKg: runnerLossMetrics.invisibleLossKg,
        invisibleLossPercent: runnerLossMetrics.invisibleLossPercent,
        totalOutputsKg: runnerLossMetrics.totalOutputsKg,
        yieldPercent: runnerLossMetrics.totalYieldPercent
      }
    );

    if (nextStatus === 'Quality Check') {
      toast.success(t(`Batch ${updatedRun.batchNumber} sent to Quality Control & TBS Lab Testing`));
      setActiveRunnerRun(null);
      openQCLabModal(updatedRun);
    } else {
      toast.success(t(`Live batch runner for ${updatedRun.batchNumber} updated`));
    }
  };

  // --------------------------------------------------------------------------
  // QUALITY CONTROL & LAB TESTING (TBS - Tanzania Bureau of Standards)
  // --------------------------------------------------------------------------
  const openQCLabModal = (run: ProductionRun) => {
    setActiveQCRun(run);
    const tmpl = companyTemplates[0] || qcTemplates[0];
    setQcTemplateId(tmpl ? tmpl.id : '');

    // Pre-fill sample compliant lab results
    const prefilled: Record<string | number, number> = {};
    if (tmpl) {
      tmpl.parameters.forEach(p => {
        if (p.paramName.toLowerCase().includes('moisture')) prefilled[p.id] = 12.8; // 10-13.5%
        else if (p.paramName.toLowerCase().includes('protein')) prefilled[p.id] = 11.5; // >10%
        else if (p.paramName.toLowerCase().includes('ash')) prefilled[p.id] = 0.65; // <0.8%
        else if (p.paramName.toLowerCase().includes('whiteness') || p.paramName.toLowerCase().includes('color')) prefilled[p.id] = 92.5; // >90
        else if (p.paramName.toLowerCase().includes('sieve')) prefilled[p.id] = 1.2; // <2%
        else prefilled[p.id] = (p.minValue || 0) + ((p.maxValue || 10) - (p.minValue || 0)) * 0.5;
      });
    }
    setQcLabInputs(prefilled);
    setQcIsOverridden(false);
    setQcOverrideDecision('Passed');
    setQcOverrideReason('');
  };

  // Real-time evaluation of QC Lab Inputs against standard specs
  const activeQCEvaluation = useMemo(() => {
    const tmpl = qcTemplates.find(t => t.id === qcTemplateId) || companyTemplates[0];
    if (!tmpl) return { labResults: [], autoDecision: 'Passed' as const };

    const labResults: QCLabResult[] = tmpl.parameters.map(param => {
      const actual = Number(qcLabInputs[param.id]) || 0;
      let status: 'passed' | 'variance' | 'failed' = 'passed';

      const minViolated = param.minValue !== undefined && actual < param.minValue;
      const maxViolated = param.maxValue !== undefined && actual > param.maxValue;

      if (minViolated || maxViolated) {
        status = param.isCritical ? 'failed' : 'variance';
      }

      return {
        parameterId: param.id,
        paramName: param.paramName,
        unit: param.unit,
        standardMin: param.minValue,
        standardMax: param.maxValue,
        isCritical: param.isCritical,
        actualValue: actual,
        status
      };
    });

    let autoDecision: 'Passed' | 'Passed with Variance' | 'Rework Required' | 'Rejected' = 'Passed';
    const hasCriticalFail = labResults.some(r => r.status === 'failed');
    const hasVariance = labResults.some(r => r.status === 'variance');

    if (hasCriticalFail) {
      autoDecision = 'Rejected';
    } else if (hasVariance) {
      autoDecision = 'Passed with Variance';
    }

    return { labResults, autoDecision };
  }, [qcTemplateId, qcTemplates, companyTemplates, qcLabInputs]);

  const handleSaveQCCheck = () => {
    if (!activeQCRun) return;
    const tmpl = qcTemplates.find(t => t.id === qcTemplateId) || companyTemplates[0];
    if (!tmpl) {
      toast.error(t('Please select a QC standard template'));
      return;
    }
    if (qcIsOverridden && !qcOverrideReason.trim()) {
      toast.error(t('Please provide mandatory explanation for overriding the auto-decision'));
      return;
    }

    const finalDecision = qcIsOverridden ? qcOverrideDecision : activeQCEvaluation.autoDecision;
    const certNumber = `TBS-QC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newCheck: BatchQCCheck = {
      id: `QC-${Date.now()}`,
      runId: activeQCRun.id,
      batchNumber: activeQCRun.batchNumber,
      productName: activeQCRun.bomName,
      templateId: tmpl.id,
      templateName: tmpl.name,
      labResults: activeQCEvaluation.labResults,
      autoDecision: activeQCEvaluation.autoDecision,
      finalDecision,
      isOverridden: qcIsOverridden,
      overrideReason: qcIsOverridden ? qcOverrideReason : undefined,
      overrideBy: qcIsOverridden ? (currentUser?.username || 'Admin') : undefined,
      inspectorId: currentUser?.id || 'INSP-1',
      inspectorName: qcInspectorName || 'QC Inspector',
      inspectorRole: 'Certified Lab Analyst (TBS/EAS)',
      signature: qcSignature || 'DIGITAL-SIGN-VERIFIED',
      checkDate: new Date().toISOString().split('T')[0],
      complianceCertNumber: certNumber,
      notes: `Batch ${activeQCRun.batchNumber} inspected under standard ${tmpl.standardRef || 'EAS 44'}.`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const nextChecks = [newCheck, ...qcChecks.filter(c => c.runId !== activeQCRun.id)];
    onSaveQCChecks(nextChecks);

    // Update run's QC status
    const updatedRun: ProductionRun = {
      ...activeQCRun,
      qcCheckId: newCheck.id,
      qcStatus: finalDecision,
      updatedAt: new Date().toISOString()
    };
    const nextRuns = productionRuns.map(r => r.id === updatedRun.id ? updatedRun : r);
    onSaveProductionRuns(nextRuns);

    if (qcIsOverridden) {
      appendAuditLog(
        activeQCRun.id,
        activeQCRun.batchNumber,
        'QC_OVERRIDE',
        t('Inspector Overrode QC Decision'),
        `Inspector ${qcInspectorName} manually overrode automated decision (${activeQCEvaluation.autoDecision}) to "${finalDecision}". Reason: ${qcOverrideReason}`,
        {
          autoDecision: activeQCEvaluation.autoDecision,
          finalDecision,
          overrideReason: qcOverrideReason,
          inspectorName: qcInspectorName,
          signature: qcSignature,
          certNumber,
          templateName: tmpl.name
        }
      );
    } else {
      appendAuditLog(
        activeQCRun.id,
        activeQCRun.batchNumber,
        'QC_EVALUATION',
        t('Quality Control Lab Inspection Certified'),
        `Laboratory evaluation completed under ${tmpl.name}. Result: ${finalDecision}. Compliance Certificate #${certNumber}.`,
        {
          autoDecision: activeQCEvaluation.autoDecision,
          finalDecision,
          certNumber,
          templateName: tmpl.name,
          inspectorName: qcInspectorName,
          labResultsCount: activeQCEvaluation.labResults.length
        }
      );
    }

    if (logAction) {
      logAction(
        'Quality Check Submitted',
        `QC check for batch ${activeQCRun.batchNumber} decided as "${finalDecision}" (Auto: ${activeQCEvaluation.autoDecision}, Overridden: ${qcIsOverridden ? 'Yes' : 'No'}).`
      );
    }

    toast.success(t(`QC Certificate ${certNumber} recorded — Status: ${finalDecision}`));
    setActiveQCRun(null);
  };

  // --------------------------------------------------------------------------
  // BATCH COMPLETION & INVENTORY MOVEMENT (Finished Goods Stock IN & Raw Materials Stock OUT)
  // --------------------------------------------------------------------------
  const handleCompleteBatch = (run: ProductionRun) => {
    if (run.status === 'Completed') {
      toast.info(t('This batch run is already marked completed.'));
      return;
    }

    const finalizeRun = () => {
      const updatedRun: ProductionRun = {
        ...run,
        status: 'Completed',
        completedDate: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString()
      };

      const nextRuns = productionRuns.map(r => r.id === updatedRun.id ? updatedRun : r);
      onSaveProductionRuns(nextRuns);

      // Fire the stock movements handler
      onCompleteBatchStock(updatedRun);

      appendAuditLog(
        run.id,
        run.batchNumber,
        'BATCH_COMPLETED',
        t('Production Batch Completed & Stocked'),
        `Batch #${run.batchNumber} successfully completed. Raw materials consumed and ${run.outputs?.length || 0} finished product / by-product lines stocked with calculated unit costs into store #${run.storeId}.`,
        {
          storeId: run.storeId,
          totalOutputKg: run.totalOutputKg,
          yieldPercent: run.yieldPercent,
          outputsCount: run.outputs?.length || 0
        }
      );

      toast.success(t(`Batch ${run.batchNumber} completed! Inventory updated for all ${run.outputs?.length || 0} output products with separate unit costs.`));
      if (logAction) {
        logAction('Production Run Completed', `Batch ${run.batchNumber} completed. Stocked ${run.totalOutputKg} kg of finished goods & by-products.`);
      }
    };

    if (run.qcStatus === 'Rejected' || run.qcStatus === 'Rework Required') {
      setConfirmModalState({
        isOpen: true,
        title: t('QC Variance Alert: Proceed with Stocking?'),
        description: t(`Warning: This batch failed QC (Status: ${run.qcStatus}). Are you sure you want to proceed with inventory completion?`),
        confirmText: t('Proceed & Stock Anyway'),
        cancelText: t('Cancel'),
        onConfirm: finalizeRun
      });
      return;
    }

    finalizeRun();
  };

  // --------------------------------------------------------------------------
  // QC TEMPLATE EDITOR HANDLERS (Multi-Industry Standards)
  // --------------------------------------------------------------------------
  const openNewTemplateModal = (category: string = 'Grain Milling') => {
    if (!canPerformCRUD) {
      toast.error(t('Only Company Admin has permission to create new QC templates.'));
      return;
    }
    setEditingTemplateId(null);
    setTmplName('');
    setTmplCategory(category);
    setTmplStandardRef('TZS 438:2021 / EAS 44');
    handleApplyIndustryPreset('grain_flour');
    setShowTemplateModal(true);
  };

  const openEditTemplateModal = (tmpl: QCTemplate) => {
    if (!canPerformCRUD) {
      toast.error(t('Only Company Admin has permission to edit QC templates.'));
      return;
    }
    setEditingTemplateId(tmpl.id);
    setTmplName(tmpl.name);
    setTmplCategory(tmpl.productCategoryId || 'Grain Milling');
    setTmplStandardRef(tmpl.standardRef || '');
    setTmplParameters((tmpl.parameters || []).map((p, i) => ({
      id: String(p.id || `param-${i}`),
      paramName: p.paramName,
      unit: p.unit,
      minValue: p.minValue,
      maxValue: p.maxValue,
      targetValue: p.targetValue,
      isCritical: p.isCritical
    })));
    setShowTemplateModal(true);
  };

  const handleDeleteTemplate = (id: string | number) => {
    if (!canPerformCRUD) {
      toast.error(t('Only Company Admin has permission to delete QC templates.'));
      return;
    }
    const targetTmpl = qcTemplates.find(t => t.id === id);
    if (!targetTmpl) return;

    setConfirmModalState({
      isOpen: true,
      title: t('Delete QC Standard Template'),
      description: t(`Are you sure you want to delete QC template "${targetTmpl.name}"? All standard test parameters will be removed.`),
      confirmText: t('Delete Template'),
      cancelText: t('Cancel'),
      onConfirm: () => {
        const next = qcTemplates.filter(t => t.id !== id);
        onSaveQCTemplates(next);
        toast.success(t(`QC Template "${targetTmpl.name}" deleted successfully`));
        if (logAction) {
          logAction('QC Template Deleted', `Deleted QC Template ${targetTmpl.name}`);
        }
      }
    });
  };

  const handleApplyIndustryPreset = (presetKey: string) => {
    if (presetKey === 'grain_flour') {
      setTmplName('Wheat Flour Grade 1 (TBS EAS 44)');
      setTmplCategory('Grain Milling');
      setTmplStandardRef('TZS 438:2021 / EAS 44:2019');
      setTmplParameters([
        { id: 'p-1', paramName: 'Moisture Content', unit: '%', minValue: 10.0, maxValue: 13.5, isCritical: true },
        { id: 'p-2', paramName: 'Protein (Dry Basis)', unit: '%', minValue: 10.0, maxValue: 16.0, isCritical: true },
        { id: 'p-3', paramName: 'Total Ash Content', unit: '%', minValue: 0.0, maxValue: 0.8, isCritical: false },
        { id: 'p-4', paramName: 'Whiteness (L* Index)', unit: 'index', minValue: 90.0, maxValue: 100.0, isCritical: false },
        { id: 'p-5', paramName: 'Sieve Retention (> 212µm)', unit: '%', minValue: 0.0, maxValue: 2.0, isCritical: false }
      ]);
    } else if (presetKey === 'edible_oil') {
      setTmplName('Refined Sunflower Cooking Oil (TBS TZS 54)');
      setTmplCategory('Edible Oil Refining');
      setTmplStandardRef('TZS 54:2020 / EAS 299');
      setTmplParameters([
        { id: 'p-1', paramName: 'Free Fatty Acids (FFA as Oleic)', unit: '%', minValue: 0.0, maxValue: 0.2, isCritical: true },
        { id: 'p-2', paramName: 'Moisture & Insoluble Impurities', unit: '%', minValue: 0.0, maxValue: 0.1, isCritical: true },
        { id: 'p-3', paramName: 'Peroxide Value', unit: 'meq/kg', minValue: 0.0, maxValue: 10.0, isCritical: true },
        { id: 'p-4', paramName: 'Color (Lovibond Red Scale)', unit: 'index', minValue: 0.0, maxValue: 3.0, isCritical: false },
        { id: 'p-5', paramName: 'Relative Density at 20°C', unit: 'g/ml', minValue: 0.915, maxValue: 0.925, isCritical: false }
      ]);
    } else if (presetKey === 'soap_detergent') {
      setTmplName('Laundry Bar Soap (TBS TZS 22)');
      setTmplCategory('Soaps & Detergents');
      setTmplStandardRef('TZS 22:2019 / EAS 31');
      setTmplParameters([
        { id: 'p-1', paramName: 'Total Fatty Matter (TFM)', unit: '%', minValue: 60.0, maxValue: 80.0, isCritical: true },
        { id: 'p-2', paramName: 'Moisture and Volatile Matter', unit: '%', minValue: 10.0, maxValue: 22.0, isCritical: true },
        { id: 'p-3', paramName: 'Free Caustic Alkali (as NaOH)', unit: '%', minValue: 0.0, maxValue: 0.05, isCritical: true },
        { id: 'p-4', paramName: 'Matter Insoluble in Alcohol', unit: '%', minValue: 0.0, maxValue: 2.5, isCritical: false },
        { id: 'p-5', paramName: 'Chloride Content (as NaCl)', unit: '%', minValue: 0.0, maxValue: 0.8, isCritical: false }
      ]);
    } else if (presetKey === 'beverage_juice') {
      setTmplName('Pasteurized Fruit Juice (TBS TZS 585)');
      setTmplCategory('Food & Beverages');
      setTmplStandardRef('TZS 585:2021');
      setTmplParameters([
        { id: 'p-1', paramName: 'Total Soluble Solids (Brix)', unit: '°Bx', minValue: 10.0, maxValue: 15.0, isCritical: true },
        { id: 'p-2', paramName: 'pH Level', unit: 'pH', minValue: 3.0, maxValue: 4.2, isCritical: true },
        { id: 'p-3', paramName: 'Titratable Acidity (as Citric)', unit: '%', minValue: 0.3, maxValue: 0.8, isCritical: false },
        { id: 'p-4', paramName: 'Specific Gravity', unit: 'g/ml', minValue: 1.04, maxValue: 1.07, isCritical: false }
      ]);
    } else if (presetKey === 'bakery_bread') {
      setTmplName('Commercial White Bread (TBS TZS 102)');
      setTmplCategory('Bakery & Confectionery');
      setTmplStandardRef('TZS 102:2019 / EAS 43');
      setTmplParameters([
        { id: 'p-1', paramName: 'Crumb Moisture Content', unit: '%', minValue: 32.0, maxValue: 38.0, isCritical: true },
        { id: 'p-2', paramName: 'Acid Insoluble Ash', unit: '%', minValue: 0.0, maxValue: 0.1, isCritical: true },
        { id: 'p-3', paramName: 'Total Ash Content (Dry Basis)', unit: '%', minValue: 0.0, maxValue: 2.0, isCritical: false },
        { id: 'p-4', paramName: 'Loaf Specific Volume', unit: 'cm³/g', minValue: 3.5, maxValue: 5.5, isCritical: false }
      ]);
    } else if (presetKey === 'plastics') {
      setTmplName('Rigid PVC Pipes (TBS TZS 100)');
      setTmplCategory('Plastics & Polymers');
      setTmplStandardRef('TZS 100:2020 / ISO 1452');
      setTmplParameters([
        { id: 'p-1', paramName: 'Tensile Yield Strength', unit: 'MPa', minValue: 45.0, maxValue: 65.0, isCritical: true },
        { id: 'p-2', paramName: 'Nominal Wall Thickness', unit: 'mm', minValue: 2.5, maxValue: 3.2, isCritical: true },
        { id: 'p-3', paramName: 'Melt Flow Index (MFI)', unit: 'g/10min', minValue: 0.5, maxValue: 2.0, isCritical: false },
        { id: 'p-4', paramName: 'Density at 23°C', unit: 'g/cm³', minValue: 1.38, maxValue: 1.45, isCritical: false }
      ]);
    } else if (presetKey === 'custom') {
      setTmplName('');
      setTmplCategory('Custom Manufacturing');
      setTmplStandardRef('Internal Standard Spec');
      setTmplParameters([
        { id: `p-${Date.now()}-1`, paramName: '', unit: '%', minValue: undefined, maxValue: undefined, isCritical: true }
      ]);
    }
  };

  const handleAddParamRow = () => {
    setTmplParameters(prev => [
      ...prev,
      {
        id: `p-${Date.now()}-${prev.length + 1}`,
        paramName: '',
        unit: '%',
        minValue: undefined,
        maxValue: undefined,
        targetValue: undefined,
        isCritical: false
      }
    ]);
  };

  const handleRemoveParamRow = (idx: number) => {
    setTmplParameters(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveTemplate = () => {
    if (!canPerformCRUD) {
      toast.error(t('Only Company Admin has permission to save QC templates.'));
      return;
    }
    if (!tmplName.trim()) {
      toast.error(t('Template name is required'));
      return;
    }
    if (tmplParameters.length === 0) {
      toast.error(t('Please add at least one lab parameter'));
      return;
    }

    const templateToSave: QCTemplate = {
      id: editingTemplateId || `QC-TMPL-${Date.now()}`,
      companyId: currentCompanyId,
      name: tmplName.trim(),
      productCategoryId: tmplCategory,
      standardRef: tmplStandardRef.trim() || 'Internal Quality Standard',
      isActive: true,
      parameters: tmplParameters.map((p, idx) => ({
        id: p.id || `param-${idx + 1}`,
        templateId: editingTemplateId || `QC-TMPL-${Date.now()}`,
        paramName: p.paramName.trim() || `Parameter ${idx + 1}`,
        unit: p.unit || '%',
        minValue: p.minValue !== undefined && p.minValue !== ('' as any) ? Number(p.minValue) : undefined,
        maxValue: p.maxValue !== undefined && p.maxValue !== ('' as any) ? Number(p.maxValue) : undefined,
        targetValue: p.targetValue !== undefined && p.targetValue !== ('' as any) ? Number(p.targetValue) : undefined,
        isCritical: Boolean(p.isCritical),
        sortOrder: idx
      })),
      updatedAt: new Date().toISOString()
    };

    if (editingTemplateId) {
      const next = qcTemplates.map(t => t.id === editingTemplateId ? templateToSave : t);
      onSaveQCTemplates(next);
      toast.success(t(`QC Template "${templateToSave.name}" updated successfully`));
    } else {
      onSaveQCTemplates([templateToSave, ...qcTemplates]);
      toast.success(t(`New QC Template "${templateToSave.name}" created`));
    }
    setShowTemplateModal(false);
  };

  const openAuditTimelineModal = (run: ProductionRun) => {
    setActiveAuditRun(run);
    setAuditFilterType('ALL');
  };
  const openTravelerModal = async (run: ProductionRun) => {
    setTravelerRun(run);
    const qrData = JSON.stringify({
      app: 'TradeCore Manufacturing',
      batch: run.batchNumber,
      runNo: run.runNumber,
      bom: run.bomName,
      inputKg: run.inputWeightKg,
      outputKg: run.totalOutputKg,
      qcStatus: run.qcStatus || 'Passed',
      date: run.completedDate || run.plannedStartDate,
      tbsCompliance: 'Verified (EAS 44:2019 / TZS 438)'
    });
    try {
      const url = await generateQrDataUrl(qrData, { width: 300 });
      setTravelerQrUrl(url);
    } catch {
      setTravelerQrUrl('');
    }
  };

  const handlePrintTraveler = () => {
    window.print();
  };

  // --------------------------------------------------------------------------
  // RENDER SECTIONS
  // --------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Module Header & Store Context */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-md border border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-400/30 shadow-xs">
              <Factory className="w-6 h-6" />
            </span>
            <h2 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2 bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent drop-shadow-xs">
              {t('Manufacturing Industry & Production Operations')}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40 flex items-center gap-1.5 shadow-xs">
              <Building2 className="w-3.5 h-3.5" />
              {activeCompany?.name || t('Active Company')}
            </span>
            {!canPerformCRUD && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-amber-300/90 border border-amber-500/30 flex items-center gap-1">
                <Lock className="w-3 h-3 text-amber-400" />
                {t('View-Only Access (Branch)')}
              </span>
            )}
          </div>
          <p className="text-xs md:text-sm text-slate-300 font-medium">
            {t('Universal multi-industry production: Joint multi-output BOMs, invisible moisture loss analytics, TBS lab quality assurance, and batch genealogy travelers.')}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {canPerformCRUD ? (
            <>
              <button
                onClick={() => openNewRunModal()}
                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> {t('New Production Order')}
              </button>
              <button
                onClick={openNewBomModal}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Sliders className="w-4 h-4" /> {t('BOM Recipe Builder')}
              </button>
            </>
          ) : (
            <div className="text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              {t('CRUD actions restricted to Company Admin')}
            </div>
          )}
        </div>
      </div>

      {/* Subpanel Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 pb-2 overflow-x-auto whitespace-nowrap scrollbar-none no-print">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Factory className="w-4 h-4" /> {t('Production Overview')}
        </button>

        <button
          onClick={() => setActiveTab('boms')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'boms'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Layers className="w-4 h-4" /> {t('Joint Product BOMs')}
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-700 text-slate-200">
            {companyBoms.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('runs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'runs'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <CheckSquare className="w-4 h-4" /> {t('Production Runs & Batches')}
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            workAvailableCount > 0
              ? 'bg-amber-500 text-slate-950 animate-pulse shadow-xs'
              : 'bg-emerald-600 text-white'
          }`}>
            {workAvailableCount > 0 ? `${workAvailableCount} ${t('Active Orders')}` : '0'}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('qc')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'qc'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Beaker className="w-4 h-4" /> {t('Quality Control & TBS Lab')}
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-600 text-white font-bold">
            {companyQcChecks.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('muv')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'muv'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Scale className="w-4 h-4" /> {t('Loss & Yield Variance (MUV)')}
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* TAB 1: PRODUCTION OVERVIEW DASHBOARD */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Production KPI Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Active Runs */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                  {t('Active Production Runs')}
                </span>
                <span className="text-2xl font-black text-gray-900 mt-1 block">
                  {overviewStats.inProgressRuns} <span className="text-xs text-gray-400 font-normal">/ {overviewStats.totalRuns} total</span>
                </span>
                <span className="text-[11px] text-emerald-600 font-bold block mt-1">
                  {overviewStats.plannedRuns} {t('batches in queue')}
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Factory className="w-6 h-6" />
              </div>
            </div>

            {/* Total Usable Yield % */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                  {t('Overall Yield Efficiency')}
                </span>
                <span className="text-2xl font-black text-emerald-600 mt-1 block">
                  {overviewStats.overallYieldPct.toFixed(1)}%
                </span>
                <span className="text-[11px] text-gray-400 font-semibold block mt-1">
                  {overviewStats.totalOutputProducedKg.toLocaleString()} kg {t('produced')}
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>

            {/* Avg Invisible Loss % (Mandatory Enhancement #2 KPI) */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block flex items-center gap-1">
                  <Droplets className="w-3.5 h-3.5 text-blue-500" />
                  {t('Avg Invisible Loss %')}
                </span>
                <span className="text-2xl font-black text-blue-600 mt-1 block">
                  {overviewStats.avgInvisibleLossPct.toFixed(2)}%
                </span>
                <span className={`text-[10px] font-bold block mt-1 px-1.5 py-0.5 rounded w-fit ${
                  overviewStats.avgInvisibleLossPct <= invisibleThreshold
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {overviewStats.avgInvisibleLossPct <= invisibleThreshold
                    ? `✓ Normal (<${invisibleThreshold}% moisture)`
                    : `⚠️ Check grain tempering`}
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Droplets className="w-6 h-6" />
              </div>
            </div>

            {/* TBS Quality Compliance Pass Rate */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  {t('TBS Lab Pass Rate')}
                </span>
                <span className="text-2xl font-black text-amber-600 mt-1 block">
                  {overviewStats.qcPassRate.toFixed(1)}%
                </span>
                <span className="text-[11px] text-gray-400 font-semibold block mt-1">
                  {companyQcChecks.length} {t('certified lab checks')}
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Active Production Queue & Live Runner Highlights */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Factory className="w-5 h-5 text-indigo-600" />
                  {t('Recent & Live Production Batches')}
                </h3>
                <p className="text-xs text-gray-400">
                  {t('Track stage advancement, loss analysis, and quality check signoffs.')}
                </p>
              </div>
              <button
                onClick={() => openNewRunModal()}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs hover:bg-indigo-100 transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> {t('Start New Batch')}
              </button>
            </div>

            {companyRuns.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl space-y-3">
                <Factory className="w-10 h-10 text-gray-300 mx-auto" />
                <h4 className="font-bold text-gray-700 text-sm">{t('No Production Runs Recorded Yet')}</h4>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  {t('Create your first multi-output production order using the pre-seeded Wheat Flour Milling recipe or create a custom BOM.')}
                </p>
                <button
                  onClick={() => openNewRunModal()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition"
                >
                  {t('Create First Production Run')}
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] border-b">
                    <tr>
                      <th className="p-3">{t('Batch Number')}</th>
                      <th className="p-3">{t('Recipe / BOM')}</th>
                      <th className="p-3 text-center">{t('Input Weight')}</th>
                      <th className="p-3 text-center">{t('Invisible Loss')}</th>
                      <th className="p-3 text-center">{t('Actual Yield')}</th>
                      <th className="p-3 text-center">{t('Status')}</th>
                      <th className="p-3 text-center">{t('TBS QC')}</th>
                      <th className="p-3 text-right">{t('Action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {companyRuns.slice(0, 10).map((run, rIdx) => {
                      const isHighLoss = (run.invisibleLossKg / (run.inputWeightKg || 1)) * 100 > warningInvisibleThreshold;
                      return (
                        <tr key={run.id != null ? String(run.id) : `overview-run-${rIdx}`} className="hover:bg-gray-50/60 transition">
                          <td className="p-3 font-mono font-bold text-gray-900">
                            {run.batchNumber}
                            <span className="block text-[10px] text-gray-400 font-normal">{run.runNumber}</span>
                          </td>
                          <td className="p-3 font-semibold text-gray-800">
                            {run.bomName}
                            <span className="block text-[10px] text-gray-400">
                              {run.outputs?.length || 0} {t('outputs')} ({run.outputs?.filter(o => o.isPrimary).length} {t('primary')})
                            </span>
                          </td>
                          <td className="p-3 text-center font-bold text-gray-700">
                            {run.inputWeightKg.toLocaleString()} kg
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              isHighLoss
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-blue-50 text-blue-700'
                            }`}>
                              {run.invisibleLossKg.toFixed(1)} kg ({run.inputWeightKg > 0 ? ((run.invisibleLossKg / run.inputWeightKg) * 100).toFixed(1) : 0}%)
                            </span>
                          </td>
                          <td className="p-3 text-center font-bold text-emerald-700">
                            {run.totalOutputKg.toLocaleString()} kg ({run.yieldPercent.toFixed(1)}%)
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              run.status === 'Completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : run.status === 'In-Progress'
                                ? 'bg-blue-100 text-blue-800 animate-pulse'
                                : run.status === 'Quality Check'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {t(run.status)}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              run.qcStatus === 'Passed'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : run.qcStatus === 'Rejected'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : run.qcStatus === 'Passed with Variance'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-gray-50 text-gray-500'
                            }`}>
                              {run.qcStatus || 'Pending'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {run.status !== 'Completed' && (
                                <button
                                  onClick={() => openBatchRunner(run)}
                                  className="px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100 transition text-[11px]"
                                  title={t('Open Live Batch Runner & Loss Analysis')}
                                >
                                  {t('Live Runner')}
                                </button>
                              )}
                              {run.status === 'Quality Check' && (
                                <button
                                  onClick={() => openQCLabModal(run)}
                                  className="px-2.5 py-1 rounded bg-purple-50 text-purple-700 font-bold hover:bg-purple-100 transition text-[11px]"
                                >
                                  {t('QC Lab')}
                                </button>
                              )}
                              <button
                                onClick={() => openTravelerModal(run)}
                                className="p-1 rounded text-gray-500 hover:bg-gray-100 transition"
                                title={t('Print Batch Traveler & TBS Certificate')}
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 2: JOINT PRODUCT / MULTI-OUTPUT BOM (RECIPE BUILDER) */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'boms' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                {t('Joint Product & Multi-Output BOM Recipes')}
              </h3>
              <p className="text-xs text-gray-500">
                {t('Multi-output recipe builder supporting flour, semolina, bran, packaging, and automatic joint-cost allocation.')}
              </p>
            </div>
            <button
              onClick={openNewBomModal}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus className="w-4 h-4" /> {t('Create New Multi-Output BOM')}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {companyBoms.map((bom, bIdx) => {
              const primaryOutputs = (bom.outputs || []).filter(o => o.isPrimary);
              const byProductOutputs = (bom.outputs || []).filter(o => !o.isPrimary);
              const rawCost = (bom.items || []).reduce((sum, i) => sum + (i.quantity * i.unitCost), 0);
              const totalCost = rawCost + (bom.packagingCost || 0) + (bom.laborCost || 0) + (bom.overheadCost || 0);

              return (
                <div key={bom.id != null ? String(bom.id) : `bom-${bIdx}`} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 flex flex-col justify-between hover:shadow-md transition">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-bold">
                          {bom.code}
                        </span>
                        <h4 className="font-extrabold text-base text-gray-900 mt-1">{bom.name}</h4>
                        <span className="text-xs text-indigo-600 font-semibold">{bom.category || 'Grain Milling'}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        bom.costAllocationMethod === 'by_market_value'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : bom.costAllocationMethod === 'by_weight'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-purple-50 text-purple-700 border border-purple-200'
                      }`}>
                        {bom.costAllocationMethod.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-xl space-y-1.5 text-xs">
                      <div className="flex justify-between text-gray-600">
                        <span>{t('Base Batch Input')}:</span>
                        <strong className="text-gray-900">{bom.baseQuantity} kg</strong>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>{t('Total Estimated Cost')}:</span>
                        <strong className="text-indigo-700">{formatMoney(totalCost, activeCurrency, activeExchangeRate)}</strong>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>{t('Raw Materials')}:</span>
                        <span>{bom.items?.length || 0} {t('ingredients')}</span>
                      </div>
                    </div>

                    {/* Outputs Breakdown */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                        {t('Outputs (Co-Products & By-Products)')}
                      </span>
                      <div className="space-y-1">
                        {primaryOutputs.map((out, oIdx) => (
                          <div key={out.id != null ? String(out.id) : `out-p-${out.productId || oIdx}`} className="flex justify-between text-xs font-semibold text-gray-800 bg-emerald-50/50 px-2.5 py-1 rounded">
                            <span className="truncate max-w-[160px]">★ {out.productName}</span>
                            <span className="text-emerald-700">{out.expectedQtyKg} kg</span>
                          </div>
                        ))}
                        {byProductOutputs.map((out, oIdx) => (
                          <div key={out.id != null ? String(out.id) : `out-bp-${out.productId || oIdx}`} className="flex justify-between text-xs font-medium text-gray-600 bg-gray-50 px-2.5 py-1 rounded">
                            <span className="truncate max-w-[160px] text-gray-500">↳ {out.productName} (by-product)</span>
                            <span className="text-gray-700">{out.expectedQtyKg} kg</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Warehouse Raw Material Stock & Production Readiness */}
                    {(() => {
                      const st = bomStockStatus[bom.id] || { producibleBatches: 0, activeBatches: 0, completedBatches: 0, missingItems: [] };
                      return (
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600 font-semibold">{t('Warehouse Parts Availability')}:</span>
                            {st.producibleBatches > 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shadow-2xs">
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                {st.producibleBatches} {t('Batches Producible')}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1" title={st.missingItems.join(', ')}>
                                <AlertTriangle className="w-3 h-3 text-amber-700" />
                                {t('Low Raw Materials')}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600 font-semibold">{t('In-Flight Batches')}:</span>
                            {st.activeBatches > 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300 animate-pulse">
                                ⚡ {st.activeBatches} {t('Active In-Flight')}
                              </span>
                            ) : (
                              <span className="text-gray-400 font-mono text-[11px]">0 {t('in progress')}</span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="pt-3 border-t flex items-center justify-between gap-2">
                    <button
                      onClick={() => openNewRunModal(bom.id)}
                      className="flex-1 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition flex items-center justify-center gap-1"
                    >
                      <Factory className="w-3.5 h-3.5" /> {t('Start Batch')}
                    </button>
                    <button
                      onClick={() => openEditBomModal(bom)}
                      className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition"
                      title={t('Edit Recipe')}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteBOM(bom.id)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition"
                      title={t('Delete Recipe')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 3: PRODUCTION RUNS & BATCH ORDERS */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'runs' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-indigo-600" />
                {t('Production Orders & Batch Runs')}
              </h3>
              <p className="text-xs text-gray-500">
                {t('Manage manufacturing orders through Planned, In-Progress, QC Lab Testing, and Inventory Completion.')}
              </p>
            </div>
            <button
              onClick={() => openNewRunModal()}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus className="w-4 h-4" /> {t('Plan Production Order')}
            </button>
          </div>

          {/* Quick Status Filter Pills & Work Alert */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> {t('Filter')}:
            </span>
            {[
              { id: 'all', label: t('All Orders'), count: companyRuns.length },
              { id: 'work_available', label: t('Work Needed'), count: workAvailableCount, alert: true },
              { id: 'Planned', label: t('Planned'), count: companyRuns.filter(r => r.status === 'Planned').length },
              { id: 'In-Progress', label: t('In-Progress'), count: companyRuns.filter(r => r.status === 'In-Progress').length },
              { id: 'Quality Check', label: t('Quality Check'), count: companyRuns.filter(r => r.status === 'Quality Check').length },
              { id: 'Completed', label: t('Completed'), count: companyRuns.filter(r => r.status === 'Completed').length }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setRunStatusFilter(f.id as any)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  runStatusFilter === f.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : f.alert && f.count > 0
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>{f.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  runStatusFilter === f.id
                    ? 'bg-white/20 text-white'
                    : f.alert && f.count > 0
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'bg-gray-200 text-gray-700'
                }`}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>

          {/* Detailed Runs Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] border-b">
                  <tr>
                    <th className="p-3">{t('Batch & Run #')}</th>
                    <th className="p-3">{t('BOM Recipe')}</th>
                    <th className="p-3 text-center">{t('Target Warehouse')}</th>
                    <th className="p-3 text-center">{t('Planned Input')}</th>
                    <th className="p-3 text-center">{t('Outputs (Yield)')}</th>
                    <th className="p-3 text-center">{t('Status')}</th>
                    <th className="p-3 text-center">{t('TBS QC Result')}</th>
                    <th className="p-3 text-right">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {filteredCompanyRuns.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-gray-400 font-medium">
                        {t('No production orders matching selected filter.')}
                      </td>
                    </tr>
                  ) : filteredCompanyRuns.map((run, rIdx) => {
                    const storeName = stores.find(s => s.id === run.storeId)?.name || `Store #${run.storeId}`;
                    return (
                      <tr key={run.id != null ? String(run.id) : `run-order-${rIdx}`} className="hover:bg-gray-50/60 transition">
                        <td className="p-3">
                          <span className="font-mono font-extrabold text-gray-900 block">{run.batchNumber}</span>
                          <span className="text-[10px] text-gray-400 font-mono">{run.runNumber}</span>
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-gray-800 block">{run.bomName}</span>
                          <span className="text-[10px] text-gray-400">Date: {run.plannedStartDate}</span>
                        </td>
                        <td className="p-3 text-center font-semibold text-gray-600">
                          {storeName}
                        </td>
                        <td className="p-3 text-center font-bold text-gray-900">
                          {run.inputWeightKg.toLocaleString()} kg
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-bold text-emerald-700 block">
                            {run.totalOutputKg.toLocaleString()} kg ({run.yieldPercent.toFixed(1)}%)
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {run.outputs?.length || 0} {t('products stocked')}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                            run.status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : run.status === 'In-Progress'
                              ? 'bg-blue-100 text-blue-800 animate-pulse'
                              : run.status === 'Quality Check'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {t(run.status)}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            run.qcStatus === 'Passed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : run.qcStatus === 'Rejected'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : run.qcStatus === 'Passed with Variance'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {run.qcStatus || 'Pending'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {run.status === 'Planned' && (
                              <button
                                onClick={() => openBatchRunner(run)}
                                className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition"
                              >
                                {t('Start Batch')}
                              </button>
                            )}
                            {run.status === 'In-Progress' && (
                              <button
                                onClick={() => openBatchRunner(run)}
                                className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] transition"
                              >
                                {t('Live Runner')}
                              </button>
                            )}
                            {run.status === 'Quality Check' && (
                              <button
                                onClick={() => openQCLabModal(run)}
                                className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] transition"
                              >
                                {t('QC Lab Test')}
                              </button>
                            )}
                            {run.status !== 'Completed' && canPerformCRUD && (
                              <button
                                onClick={() => handleCompleteBatch(run)}
                                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition"
                                title={t('Finalize batch and add finished products to stock')}
                              >
                                {t('Complete & Stock')}
                              </button>
                            )}
                            <button
                              onClick={() => openAuditTimelineModal(run)}
                              className="p-1 rounded text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 transition"
                              title={t('Production Order Audit Trail & Timeline')}
                            >
                              <History className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openTravelerModal(run)}
                              className="p-1 rounded text-gray-500 hover:bg-gray-100 transition"
                              title={t('Print Batch Traveler & TBS Slip')}
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            {canPerformCRUD && (
                              <button
                                onClick={() => handleDeleteRun(run.id)}
                                className="p-1 rounded text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
                                title={t('Delete Production Order')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 4: QUALITY CONTROL & TBS LAB TESTING (Enhancement #3) */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'qc' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Beaker className="w-5 h-5 text-indigo-600" />
                {t('TBS Quality Control & Laboratory Parameters')}
              </h3>
              <p className="text-xs text-gray-500">
                {t('Tanzania Bureau of Standards (TBS) compliance testing, automated numeric pass/fail logic, and certified signoffs.')}
              </p>
            </div>
            {canPerformCRUD && (
              <button
                onClick={openNewTemplateModal}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
              >
                <Plus className="w-4 h-4" /> {t('New QC Template')}
              </button>
            )}
          </div>

          {/* Templates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {companyTemplates.map((tmpl, tIdx) => (
              <div key={tmpl.id != null ? String(tmpl.id) : `tmpl-${tIdx}`} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 hover:shadow-md transition">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                        {tmpl.standardRef || 'EAS 44:2019'}
                      </span>
                      {tmpl.productCategoryId && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          {tmpl.productCategoryId}
                        </span>
                      )}
                    </div>
                    <h4 className="font-extrabold text-base text-gray-900 mt-1">{tmpl.name}</h4>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Award className="w-5 h-5 text-amber-500" />
                    {canPerformCRUD && (
                      <div className="flex items-center gap-1 ml-1 bg-gray-50 rounded-lg p-0.5 border">
                        <button
                          onClick={() => openEditTemplateModal(tmpl)}
                          className="p-1 rounded hover:bg-indigo-50 text-gray-500 hover:text-indigo-600 transition"
                          title={t('Edit QC Template')}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(tmpl.id)}
                          className="p-1 rounded hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition"
                          title={t('Delete QC Template')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                    {t('Lab Parameters & Numeric Thresholds')}
                  </span>
                  <div className="space-y-1">
                    {tmpl.parameters.map((p, pIdx) => (
                      <div key={p.id != null ? String(p.id) : `tmpl-param-${pIdx}`} className="flex items-center justify-between text-xs p-1.5 rounded bg-gray-50">
                        <span className="font-medium text-gray-800 flex items-center gap-1">
                          {p.isCritical && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" title="Critical Parameter" />}
                          {p.paramName}
                        </span>
                        <span className="font-mono text-gray-600 text-[11px]">
                          {p.minValue !== undefined ? p.minValue : ''} - {p.maxValue !== undefined ? p.maxValue : ''} {p.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Certified Quality Checks History */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h4 className="font-bold text-sm text-gray-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              {t('Certified QC Inspection Records & Compliance Slips')}
            </h4>

            {companyQcChecks.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-6 text-center">
                {t('No QC inspection checks recorded yet. Send an active batch to Quality Check to record lab measurements.')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] border-b">
                    <tr>
                      <th className="p-3">{t('Cert #')}</th>
                      <th className="p-3">{t('Batch Number')}</th>
                      <th className="p-3">{t('Standard Template')}</th>
                      <th className="p-3 text-center">{t('Auto Decision')}</th>
                      <th className="p-3 text-center">{t('Final Decision')}</th>
                      <th className="p-3">{t('Inspector & Signature')}</th>
                      <th className="p-3 text-right">{t('Date')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {companyQcChecks.map((check, cIdx) => (
                      <tr key={check.id != null ? String(check.id) : `qc-rec-${cIdx}`} className="hover:bg-gray-50/60">
                        <td className="p-3 font-mono font-extrabold text-indigo-700">
                          {check.complianceCertNumber || check.id}
                        </td>
                        <td className="p-3 font-mono font-bold text-gray-900">
                          {check.batchNumber}
                        </td>
                        <td className="p-3 text-gray-700 font-semibold">
                          {check.templateName}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            check.autoDecision === 'Passed'
                              ? 'bg-emerald-50 text-emerald-700'
                              : check.autoDecision === 'Rejected'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {check.autoDecision}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            check.finalDecision === 'Passed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : check.finalDecision === 'Rejected'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {check.finalDecision}
                            {check.isOverridden && <span className="ml-1 text-[9px] font-normal" title={check.overrideReason}>({t('Overridden')})</span>}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-gray-800 block">{check.inspectorName}</span>
                          <span className="text-[10px] text-gray-400 font-mono">{check.signature}</span>
                        </td>
                        <td className="p-3 text-right font-mono text-gray-500">
                          {check.checkDate}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 5: MATERIAL USAGE VARIANCE (MUV) & LOSS ANALYSIS (Enhancement #2) */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'muv' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Scale className="w-5 h-5 text-indigo-600" />
                {t('Material Usage Variance (MUV) & Loss Analysis Report')}
              </h3>
              <p className="text-xs text-gray-500">
                {t('Distinguishes physical cleaning loss (mawe/vumbi), milling scrap, and natural moisture evaporation (invisible loss < 3%).')}
              </p>
            </div>
            <div className="flex items-center gap-2 bg-blue-50 text-blue-800 px-3 py-1.5 rounded-xl border border-blue-200 text-xs font-bold">
              <Droplets className="w-4 h-4 text-blue-500" />
              <span>{t('Config Threshold')}: {invisibleThreshold}% ({t('Moisture Loss Tolerance')})</span>
            </div>
          </div>

          {/* MUV Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{t('Total Raw Weighed')}</span>
              <span className="text-2xl font-black text-gray-900 mt-1 block">
                {overviewStats.totalRawWeighedKg.toLocaleString()} kg
              </span>
              <span className="text-xs text-gray-500 font-medium mt-1 block">{t('Standard 100% input weight')}</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{t('Cleaning Loss (Mawe/Vumbi)')}</span>
              <span className="text-2xl font-black text-amber-600 mt-1 block">
                {overviewStats.totalCleaningLossKg.toLocaleString()} kg
              </span>
              <span className="text-xs text-amber-700 font-medium mt-1 block">
                {overviewStats.totalRawWeighedKg > 0 ? ((overviewStats.totalCleaningLossKg / overviewStats.totalRawWeighedKg) * 100).toFixed(2) : 0}% {t('foreign matter')}
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{t('Invisible Loss (Moisture)')}</span>
              <span className="text-2xl font-black text-blue-600 mt-1 block">
                {overviewStats.totalInvisibleLossKg.toLocaleString()} kg
              </span>
              <span className="text-xs text-blue-700 font-bold mt-1 block">
                {overviewStats.avgInvisibleLossPct.toFixed(2)}% ({t('Evaporation variance')})
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{t('Total Usable Outputs')}</span>
              <span className="text-2xl font-black text-emerald-600 mt-1 block">
                {overviewStats.totalOutputProducedKg.toLocaleString()} kg
              </span>
              <span className="text-xs text-emerald-700 font-bold mt-1 block">
                {overviewStats.overallYieldPct.toFixed(2)}% {t('Net flour & bran yield')}
              </span>
            </div>
          </div>

          {/* Batch-by-Batch MUV Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h4 className="font-bold text-sm text-gray-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              {t('Batch Material Usage & Yield Variance Log')}
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] border-b">
                  <tr>
                    <th className="p-3">{t('Batch #')}</th>
                    <th className="p-3 text-right">{t('Standard Input')}</th>
                    <th className="p-3 text-right">{t('Actual Input')}</th>
                    <th className="p-3 text-right">{t('Cleaning Loss')}</th>
                    <th className="p-3 text-right">{t('Invisible Loss')}</th>
                    <th className="p-3 text-right">{t('Usable Output')}</th>
                    <th className="p-3 text-right">{t('Total Yield')}</th>
                    <th className="p-3 text-center">{t('Variance Evaluation')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {companyRuns.map((run, rIdx) => {
                    const invisPct = run.inputWeightKg > 0 ? (run.invisibleLossKg / run.inputWeightKg) * 100 : 0;
                    const isWithinThreshold = invisPct <= invisibleThreshold;
                    const isHighAlert = invisPct > warningInvisibleThreshold;

                    return (
                      <tr key={run.id != null ? String(run.id) : `muv-row-${rIdx}`} className="hover:bg-gray-50/60 font-mono">
                        <td className="p-3 font-bold text-gray-900">{run.batchNumber}</td>
                        <td className="p-3 text-right text-gray-600">{run.inputWeightKg.toLocaleString()} kg</td>
                        <td className="p-3 text-right text-gray-800 font-bold">{run.inputWeightKg.toLocaleString()} kg</td>
                        <td className="p-3 text-right text-amber-700 font-bold">
                          {run.cleaningLossKg} kg ({run.inputWeightKg > 0 ? ((run.cleaningLossKg / run.inputWeightKg) * 100).toFixed(1) : 0}%)
                        </td>
                        <td className="p-3 text-right text-blue-700 font-bold">
                          {run.invisibleLossKg.toFixed(1)} kg ({invisPct.toFixed(1)}%)
                        </td>
                        <td className="p-3 text-right text-emerald-700 font-extrabold">
                          {run.totalOutputKg.toLocaleString()} kg
                        </td>
                        <td className="p-3 text-right font-extrabold text-gray-900">
                          {run.yieldPercent.toFixed(1)}%
                        </td>
                        <td className="p-3 text-center font-sans">
                          {isWithinThreshold ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ✓ {t('Normal Moisture Loss')}
                            </span>
                          ) : isHighAlert ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              ⚠️ {t('Check Moisture Meter')}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">
                              {t('Acceptable Variance')}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 1: BOM RECIPE BUILDER (JOINT PRODUCT / MULTI-OUTPUT) */}
      {/* ------------------------------------------------------------------ */}
      {showBomModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-6 space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Sliders className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-extrabold text-base text-gray-900">
                    {editingBomId ? t('Edit Multi-Output Recipe') : t('Create Joint Product / Multi-Output BOM')}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {t('Define raw material inputs and split batch costs across multiple finished goods & by-products.')}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowBomModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div className="sm:col-span-2 space-y-1">
                <label className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">{t('Recipe / BOM Name')}</label>
                <input
                  type="text"
                  value={bomName}
                  onChange={e => setBomName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl font-bold bg-gray-50 outline-none"
                  placeholder="e.g. Wheat Flour Milling 1000kg"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">{t('BOM Code')}</label>
                <input
                  type="text"
                  value={bomCode}
                  onChange={e => setBomCode(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl font-mono font-bold uppercase bg-gray-50 outline-none"
                  placeholder="BOM-WF-1000"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">{t('Base Batch Input (kg)')}</label>
                <input
                  type="number"
                  value={safeNumValue(bomBaseQty)}
                  onChange={e => setBomBaseQty(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border rounded-xl font-bold bg-gray-50 outline-none"
                  min="1"
                />
              </div>
            </div>

            {/* RAW MATERIALS SECTION */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                    <Factory className="w-4 h-4 text-indigo-600" />
                    {t('1. Raw Material Inputs (Consumed Ingredients)')}
                  </h4>
                  <span className="text-[11px] text-gray-400">{t('Products deducted from warehouse stock upon batch completion.')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextId = Date.now() + bomRawItems.length;
                    setBomRawItems([
                      ...bomRawItems,
                      {
                        productId: nextId,
                        productName: '',
                        quantity: 100,
                        unitCost: 1000,
                        unit: 'kg',
                        scrapAllowancePercent: 1.0
                      }
                    ]);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs hover:bg-indigo-100 transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> {t('Add Raw Material')}
                </button>
              </div>

              <div className="space-y-2">
                {bomRawItems.map((item, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row items-center gap-2 bg-gray-50 p-2.5 rounded-xl border text-xs">
                    {/* Free-Text Raw Material Name with Datalist Suggestions */}
                    <div className="flex-1 w-full sm:w-auto space-y-0.5">
                      <input
                        type="text"
                        list={`raw-materials-datalist-${idx}`}
                        value={item.productName}
                        onChange={e => {
                          const val = e.target.value;
                          const matched = stockItems.find(p => p.name.toLowerCase() === val.toLowerCase());
                          const copy = [...bomRawItems];
                          copy[idx] = {
                            ...copy[idx],
                            productName: val,
                            productId: matched ? matched.id : (copy[idx].productId || Date.now() + idx),
                            unitCost: matched ? matched.purchasePrice : copy[idx].unitCost
                          };
                          setBomRawItems(copy);
                        }}
                        placeholder={t('Write raw material name (e.g. Raw Wheat Grain, Crude Oil, Caustic Soda, Water)...')}
                        className="w-full px-3 py-1.5 border rounded-lg bg-white font-bold text-gray-900 outline-none focus:border-indigo-500 text-xs shadow-2xs"
                      />
                      <datalist id={`raw-materials-datalist-${idx}`}>
                        {stockItems.map((p, pIdx) => (
                          <option key={p.id != null ? String(p.id) : `stk-raw-${pIdx}`} value={p.name}>{p.name} ({p.code})</option>
                        ))}
                      </datalist>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="w-24">
                        <input
                          type="number"
                          value={safeNumValue(item.quantity)}
                          onChange={e => {
                            const copy = [...bomRawItems];
                            copy[idx].quantity = parseFloat(e.target.value) || 0;
                            setBomRawItems(copy);
                          }}
                          className="w-full px-2 py-1.5 border rounded-lg bg-white font-bold text-center outline-none"
                          placeholder="Qty"
                        />
                      </div>
                      <div className="w-16">
                        <input
                          type="text"
                          value={item.unit || 'kg'}
                          onChange={e => {
                            const copy = [...bomRawItems];
                            copy[idx].unit = e.target.value;
                            setBomRawItems(copy);
                          }}
                          className="w-full px-1.5 py-1.5 border rounded-lg bg-white font-mono text-center text-xs outline-none"
                          placeholder="Unit"
                          title={t('Unit of measure (e.g. kg, L, bags)')}
                        />
                      </div>

                      <div className="w-28">
                        <input
                          type="number"
                          value={safeNumValue(item.unitCost)}
                          onChange={e => {
                            const copy = [...bomRawItems];
                            copy[idx].unitCost = parseFloat(e.target.value) || 0;
                            setBomRawItems(copy);
                          }}
                          className="w-full px-2 py-1.5 border rounded-lg bg-white font-mono text-right outline-none"
                          placeholder="Unit Cost"
                        />
                      </div>

                      <span className="w-28 text-right font-bold text-indigo-700">
                        {formatMoney(item.quantity * item.unitCost, activeCurrency, activeExchangeRate)}
                      </span>

                      <button
                        type="button"
                        onClick={() => setBomRawItems(bomRawItems.filter((_, i) => i !== idx))}
                        className="p-1 text-rose-500 hover:bg-rose-100 rounded transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* OPERATING COSTS */}
            <div className="border-t pt-4 space-y-3">
              <h4 className="font-bold text-sm text-gray-900">{t('2. Packaging, Labor & Overhead Expenses')}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="font-bold text-gray-600 block text-[10px] uppercase mb-1">{t('Packaging Material (Bags, Seals)')}</label>
                  <input
                    type="number"
                    value={safeNumValue(bomPackagingCost)}
                    onChange={e => setBomPackagingCost(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border rounded-xl font-mono text-right outline-none bg-gray-50"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-600 block text-[10px] uppercase mb-1">{t('Direct Labor / Miller Wages')}</label>
                  <input
                    type="number"
                    value={safeNumValue(bomLaborCost)}
                    onChange={e => setBomLaborCost(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border rounded-xl font-mono text-right outline-none bg-gray-50"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-600 block text-[10px] uppercase mb-1">{t('Factory Overhead / Electricity')}</label>
                  <input
                    type="number"
                    value={safeNumValue(bomOverheadCost)}
                    onChange={e => setBomOverheadCost(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border rounded-xl font-mono text-right outline-none bg-gray-50"
                  />
                </div>
              </div>
            </div>

            {/* MULTI-OUTPUT & COST ALLOCATION METHOD (Core Enhancement #1) */}
            <div className="border-t pt-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    {t('3. Expected Outputs (Joint Products & By-Products)')}
                  </h4>
                  <span className="text-[11px] text-gray-400">
                    {t('Allocates the total batch cost across multiple finished products and bran.')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextId = Date.now() + 100 + bomOutputs.length;
                    setBomOutputs([
                      ...bomOutputs,
                      {
                        id: `out-${Date.now()}`,
                        bomId: editingBomId || '',
                        productId: nextId,
                        productName: '',
                        isPrimary: true,
                        expectedQtyKg: 100,
                        expectedMarketPrice: 2000,
                        allocationPercent: 10
                      }
                    ]);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs hover:bg-emerald-100 transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> {t('Add Output Product')}
                </button>
              </div>

              {/* Cost Allocation Method Radio Selector */}
              <div className="bg-gray-50 p-3 rounded-xl border space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
                  {t('Cost Allocation Method (Mbinu ya Kugawanya Gharama)')}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className={`p-2.5 rounded-xl border flex items-start gap-2 cursor-pointer transition ${
                    bomAllocationMethod === 'by_market_value' ? 'bg-emerald-50 border-emerald-400' : 'bg-white border-gray-200'
                  }`}>
                    <input
                      type="radio"
                      name="allocation_method"
                      value="by_market_value"
                      checked={bomAllocationMethod === 'by_market_value'}
                      onChange={() => setBomAllocationMethod('by_market_value')}
                      className="mt-0.5"
                    />
                    <div>
                      <strong className="text-xs block text-gray-900">{t('By Market Value')}</strong>
                      <span className="text-[10px] text-gray-500">{t('Cost allocated proportionally by total sales value (Qty × Price).')}</span>
                    </div>
                  </label>

                  <label className={`p-2.5 rounded-xl border flex items-start gap-2 cursor-pointer transition ${
                    bomAllocationMethod === 'by_weight' ? 'bg-blue-50 border-blue-400' : 'bg-white border-gray-200'
                  }`}>
                    <input
                      type="radio"
                      name="allocation_method"
                      value="by_weight"
                      checked={bomAllocationMethod === 'by_weight'}
                      onChange={() => setBomAllocationMethod('by_weight')}
                      className="mt-0.5"
                    />
                    <div>
                      <strong className="text-xs block text-gray-900">{t('By Weight (Mass Fraction)')}</strong>
                      <span className="text-[10px] text-gray-500">{t('Cost allocated proportionally by output weight in kg.')}</span>
                    </div>
                  </label>

                  <label className={`p-2.5 rounded-xl border flex items-start gap-2 cursor-pointer transition ${
                    bomAllocationMethod === 'manual' ? 'bg-purple-50 border-purple-400' : 'bg-white border-gray-200'
                  }`}>
                    <input
                      type="radio"
                      name="allocation_method"
                      value="manual"
                      checked={bomAllocationMethod === 'manual'}
                      onChange={() => setBomAllocationMethod('manual')}
                      className="mt-0.5"
                    />
                    <div>
                      <strong className="text-xs block text-gray-900">{t('Manual Percent (%)')}</strong>
                      <span className="text-[10px] text-gray-500">{t('User defines exact cost percentage per item.')}</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Dynamic Outputs Table */}
              <div className="overflow-x-auto border rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100/70 text-gray-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">{t('Output Product (Finished / By-Product)')}</th>
                      <th className="p-2.5 text-center">{t('Expected Qty (kg)')}</th>
                      <th className="p-2.5 text-right">{t('Market Price / kg')}</th>
                      <th className="p-2.5 text-center">{t('Is Primary?')}</th>
                      {bomAllocationMethod === 'manual' && <th className="p-2.5 text-center">{t('Allocation %')}</th>}
                      <th className="p-2.5 text-right">{t('Est. Unit Cost')}</th>
                      <th className="p-2.5 text-right w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {(() => {
                      const rawCost = bomRawItems.reduce((sum, i) => sum + (i.quantity * i.unitCost), 0);
                      const totalBatchCost = rawCost + Number(bomPackagingCost) + Number(bomLaborCost) + Number(bomOverheadCost);
                      const previewCalculated = calculateOutputCosts(
                        bomAllocationMethod,
                        totalBatchCost,
                        bomOutputs
                      );

                      return bomOutputs.map((out, idx) => {
                        const calculated = previewCalculated[idx];
                        return (
                          <tr key={out.id != null ? String(out.id) : `bom-out-${idx}`} className="hover:bg-gray-50/50">
                            <td className="p-2.5">
                              <input
                                type="text"
                                list={`output-products-datalist-${idx}`}
                                value={out.productName}
                                onChange={e => {
                                  const val = e.target.value;
                                  const matched = stockItems.find(p => p.name.toLowerCase() === val.toLowerCase());
                                  const copy = [...bomOutputs];
                                  copy[idx] = {
                                    ...copy[idx],
                                    productName: val,
                                    productId: matched ? matched.id : (copy[idx].productId || Date.now() + 100 + idx),
                                    expectedMarketPrice: matched ? matched.retailPrice : copy[idx].expectedMarketPrice
                                  };
                                  setBomOutputs(copy);
                                }}
                                placeholder={t('Write output product name (e.g. Flour 25kg, Semolina, Bran)...')}
                                className="w-full px-2.5 py-1.5 border rounded-lg bg-white font-bold text-gray-900 outline-none focus:border-emerald-500 text-xs shadow-2xs"
                              />
                              <datalist id={`output-products-datalist-${idx}`}>
                                {stockItems.map((p, pIdx) => (
                                  <option key={p.id != null ? String(p.id) : `stk-out-${pIdx}`} value={p.name}>{p.name} ({p.code})</option>
                                ))}
                              </datalist>
                            </td>
                            <td className="p-2.5 text-center">
                              <input
                                type="number"
                                value={safeNumValue(out.expectedQtyKg)}
                                onChange={e => {
                                  const copy = [...bomOutputs];
                                  copy[idx].expectedQtyKg = parseFloat(e.target.value) || 0;
                                  setBomOutputs(copy);
                                }}
                                className="w-20 px-2 py-1 border rounded text-center font-bold outline-none"
                              />
                            </td>
                            <td className="p-2.5 text-right">
                              <input
                                type="number"
                                value={safeNumValue(out.expectedMarketPrice)}
                                onChange={e => {
                                  const copy = [...bomOutputs];
                                  copy[idx].expectedMarketPrice = parseFloat(e.target.value) || 0;
                                  setBomOutputs(copy);
                                }}
                                className="w-24 px-2 py-1 border rounded text-right font-mono outline-none"
                              />
                            </td>
                            <td className="p-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={out.isPrimary}
                                onChange={e => {
                                  const copy = [...bomOutputs];
                                  copy[idx].isPrimary = e.target.checked;
                                  setBomOutputs(copy);
                                }}
                                className="w-4 h-4 accent-emerald-600 cursor-pointer"
                              />
                            </td>
                            {bomAllocationMethod === 'manual' && (
                              <td className="p-2.5 text-center">
                                <input
                                  type="number"
                                  value={safeNumValue(out.allocationPercent)}
                                  onChange={e => {
                                    const copy = [...bomOutputs];
                                    copy[idx].allocationPercent = parseFloat(e.target.value) || 0;
                                    setBomOutputs(copy);
                                  }}
                                  className="w-16 px-1.5 py-1 border rounded text-center font-bold outline-none"
                                />
                                %
                              </td>
                            )}
                            <td className="p-2.5 text-right font-mono font-bold text-indigo-700">
                              {formatMoney(calculated?.unitCost || 0, activeCurrency, activeExchangeRate)} / kg
                            </td>
                            <td className="p-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => setBomOutputs(bomOutputs.filter((_, i) => i !== idx))}
                                className="text-rose-500 hover:text-rose-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Total Output Weight & Mass Balance */}
              <div className="flex items-center justify-between text-xs font-bold text-gray-700 bg-gray-50 p-3 rounded-xl border">
                <span>
                  {t('Total Expected Output Weight')}:{' '}
                  <strong className="text-emerald-700">{bomOutputs.reduce((sum, o) => sum + (o.expectedQtyKg || 0), 0)} kg</strong>
                </span>
                <span>
                  {t('Target Yield')}:{' '}
                  <strong className="text-indigo-700">
                    {bomBaseQty > 0
                      ? ((bomOutputs.reduce((sum, o) => sum + (o.expectedQtyKg || 0), 0) / bomBaseQty) * 100).toFixed(1)
                      : 0}%
                  </strong>
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => setShowBomModal(false)}
                className="px-4 py-2 border rounded-xl font-bold text-xs text-gray-600 hover:bg-gray-100 transition"
              >
                {t('Cancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveBOM}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition"
              >
                {t('Save Bill of Materials')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 2: PLAN PRODUCTION RUN MODAL */}
      {/* ------------------------------------------------------------------ */}
      {showCreateRunModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <Factory className="w-5 h-5" />
                </span>
                <h3 className="font-extrabold text-base text-gray-900">{t('Plan Production Order / Batch')}</h3>
              </div>
              <button onClick={() => setShowCreateRunModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-700 uppercase tracking-wider text-[10px] block mb-1">
                  {t('Select BOM Recipe')}
                </label>
                <select
                  value={runBomId}
                  onChange={e => {
                    setRunBomId(e.target.value);
                    const b = boms.find(x => String(x.id) === String(e.target.value));
                    if (b) setRunInputWeightKg(b.baseQuantity);
                  }}
                  className="w-full px-3 py-2 border rounded-xl font-bold bg-gray-50 outline-none"
                >
                  {companyBoms.map((b, bIdx) => (
                    <option key={b.id != null ? String(b.id) : `b-opt-${bIdx}`} value={b.id}>{b.name} ({b.code}) - {b.baseQuantity} kg</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 uppercase tracking-wider text-[10px] block mb-1">
                    {t('Batch Number')}
                  </label>
                  <input
                    type="text"
                    value={runBatchNumber}
                    onChange={e => setRunBatchNumber(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl font-mono font-bold bg-gray-50 outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 uppercase tracking-wider text-[10px] block mb-1">
                    {t('Raw Input Weight (kg)')}
                  </label>
                  <input
                    type="number"
                    value={safeNumValue(runInputWeightKg)}
                    onChange={e => setRunInputWeightKg(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border rounded-xl font-bold bg-gray-50 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 uppercase tracking-wider text-[10px] block mb-1">
                    {t('Planned Date')}
                  </label>
                  <input
                    type="date"
                    value={runPlannedDate}
                    onChange={e => setRunPlannedDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl bg-gray-50 outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 uppercase tracking-wider text-[10px] block mb-1">
                    {t('Target Expiry Date')}
                  </label>
                  <input
                    type="date"
                    value={runExpiryDate}
                    onChange={e => setRunExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl bg-gray-50 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 uppercase tracking-wider text-[10px] block mb-1">
                  {t('Target Production Warehouse / Depot')}
                </label>
                <select
                  value={runStoreId}
                  onChange={e => setRunStoreId(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-xl font-bold bg-gray-50 outline-none"
                >
                  {stores.map((s, sIdx) => (
                    <option key={s.id != null ? String(s.id) : `s-opt-${sIdx}`} value={s.id}>{s.name} - {s.location || 'Main Depot'}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-gray-700 uppercase tracking-wider text-[10px] block mb-1">
                  {t('Operational Notes / Shift')}
                </label>
                <textarea
                  value={runNotes}
                  onChange={e => setRunNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-gray-50 outline-none"
                  rows={2}
                  placeholder="e.g. Shift A, Mill 2, conditioned grain at 14% moisture"
                />
              </div>

              {/* Production Run Mode (Immediate Launch vs Planned Scheduling) */}
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-2">
                <span className="font-bold text-gray-800 uppercase tracking-wider text-[10px] block">
                  {t('Production Execution Mode')}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRunStartImmediately(true)}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      runStartImmediately
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-extrabold text-xs">
                      <Factory className="w-4 h-4" />
                      {t('Start Now (In-Progress)')}
                    </div>
                    <span className={`text-[10px] block mt-1 leading-tight ${runStartImmediately ? 'text-emerald-100' : 'text-gray-500'}`}>
                      {t('Immediately deducts parts from warehouse stock')}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRunStartImmediately(false)}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      !runStartImmediately
                        ? 'bg-slate-900 text-white border-slate-950 shadow-xs'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-extrabold text-xs">
                      <Clock className="w-4 h-4" />
                      {t('Schedule (Planned)')}
                    </div>
                    <span className={`text-[10px] block mt-1 leading-tight ${!runStartImmediately ? 'text-slate-300' : 'text-gray-500'}`}>
                      {t('Leaves parts in inventory until batch starts')}
                    </span>
                  </button>
                </div>
              </div>

              {/* Parts Consumption Preview */}
              {(() => {
                const b = boms.find(x => String(x.id) === String(runBomId)) || companyBoms[0];
                if (!b || !b.items || b.items.length === 0) return null;
                const scale = runInputWeightKg > 0 && b.baseQuantity > 0 ? runInputWeightKg / b.baseQuantity : 1;
                return (
                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200/80 space-y-1.5">
                    <span className="font-bold text-[10px] text-gray-500 uppercase tracking-wider block">
                      {t('Parts to be Consumed from Warehouse')} #{runStoreId}:
                    </span>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {b.items.map((item, itemIdx) => {
                        const needed = Math.round(item.quantity * scale * 100) / 100;
                        const p = stockItems.find(x => String(x.id) === String(item.productId) || (item.productName && x.name.toLowerCase() === item.productName.toLowerCase()));
                        const available = p?.stock?.[runStoreId] || 0;
                        const isShort = available < needed;
                        const itemKey = (item as any).id != null ? String((item as any).id) : item.productId != null ? `part-${item.productId}` : `part-${itemIdx}`;
                        return (
                          <div key={itemKey} className="flex items-center justify-between text-[11px] py-0.5">
                            <span className="font-medium text-gray-700 truncate max-w-[200px]">{item.productName}</span>
                            <span className={`font-mono font-bold ${isShort ? 'text-rose-600' : 'text-emerald-700'}`}>
                              {needed} kg {isShort ? `(${t('Avail')}: ${available})` : `✓`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowCreateRunModal(false)}
                className="px-4 py-2 border rounded-xl font-bold text-xs text-gray-600 hover:bg-gray-100"
              >
                {t('Cancel')}
              </button>
              <button
                type="button"
                onClick={handleCreateProductionRun}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer flex items-center gap-1.5"
              >
                <Factory className="w-3.5 h-3.5" />
                {runStartImmediately ? t('Start Batch & Deduct Stock') : t('Schedule Production Order')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 3: LIVE BATCH RUNNER & LOSS ANALYSIS (Enhancement #2) */}
      {/* ------------------------------------------------------------------ */}
      {activeRunnerRun && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6 space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono font-bold text-xs">
                    {activeRunnerRun.batchNumber}
                  </span>
                  <h3 className="font-black text-base text-gray-900">
                    {t('Live Batch Runner & Output Yield Tracking')}
                  </h3>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {activeRunnerRun.bomName} · {activeRunnerRun.inputWeightKg.toLocaleString()} kg {t('Raw Weighed Input')}
                </p>
              </div>
              <button onClick={() => setActiveRunnerRun(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* LOSS ANALYSIS SECTION (Core Enhancement #2) */}
            <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-blue-400" />
                  {t('Loss Analysis (Upotevu wa Nafaka & Uvukizi wa Unyevu)')}
                </h4>
                <span className="text-[11px] font-mono text-slate-300">
                  {t('Input')}: {activeRunnerRun.inputWeightKg} kg
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">
                    {t('Cleaning Loss (Mawe / Vumbi / Chaff)')} (kg)
                  </label>
                  <input
                    type="number"
                    value={safeNumValue(runnerCleaningLoss)}
                    onChange={e => setRunnerCleaningLoss(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 text-white border border-slate-700 font-bold outline-none"
                    placeholder="e.g. 12"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">
                    {t('Milling Scrap / Off-spec Spillage')} (kg)
                  </label>
                  <input
                    type="number"
                    value={safeNumValue(runnerMillingScrap)}
                    onChange={e => setRunnerMillingScrap(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 text-white border border-slate-700 font-bold outline-none"
                    placeholder="e.g. 10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">{t('Moisture Before Milling (%)')}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={safeNumValue(runnerMoistureBefore)}
                    onChange={e => setRunnerMoistureBefore(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-800 text-white border border-slate-700 font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">{t('Moisture After Milling (%)')}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={safeNumValue(runnerMoistureAfter)}
                    onChange={e => setRunnerMoistureAfter(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-800 text-white border border-slate-700 font-mono outline-none"
                  />
                </div>
              </div>

              {/* AUTO-CALCULATED INVISIBLE LOSS CARD */}
              <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
                runnerLossMetrics.invisibleLossPercent > warningInvisibleThreshold
                  ? 'bg-amber-950/70 border-amber-500/50 text-amber-200'
                  : 'bg-blue-950/60 border-blue-500/40 text-blue-200'
              }`}>
                <div>
                  <span className="text-[11px] uppercase tracking-wider font-extrabold block">
                    {t('Auto-Calculated Invisible Loss (Moisture Evaporation)')}
                  </span>
                  <span className="text-xl font-black block mt-0.5">
                    {runnerLossMetrics.invisibleLossKg.toFixed(1)} kg ({runnerLossMetrics.invisibleLossPercent.toFixed(2)}%)
                  </span>
                </div>
                <div className="text-right text-[11px]">
                  {runnerLossMetrics.invisibleLossPercent > warningInvisibleThreshold ? (
                    <span className="px-2.5 py-1 rounded bg-amber-500/30 text-amber-200 border border-amber-400 font-bold block">
                      ⚠️ {t('High Loss (> 5%): Check moisture meter')}
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded bg-emerald-500/30 text-emerald-200 border border-emerald-400 font-bold block">
                      ✓ {t('Normal milling moisture loss (< 3%)')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ACTUAL OUTPUT QUANTITIES PRODUCED */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                  {t('Actual Output Yield Weighed & Unit Cost Allocation')}
                </h4>
                <span className="text-xs font-bold text-emerald-700">
                  {t('Yield')}: {runnerLossMetrics.totalYieldPercent.toFixed(1)}% ({runnerLossMetrics.totalOutputsKg.toLocaleString()} kg)
                </span>
              </div>

              <div className="overflow-x-auto border rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">{t('Output Product')}</th>
                      <th className="p-2.5 text-center">{t('Expected (kg)')}</th>
                      <th className="p-2.5 text-center">{t('Actual Produced (kg)')}</th>
                      <th className="p-2.5 text-right">{t('Market Price')}</th>
                      <th className="p-2.5 text-right">{t('Allocated Unit Cost')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {activeRunnerRun.outputs.map((out, outIdx) => {
                      const actual = runnerOutputActuals[out.productId] !== undefined ? runnerOutputActuals[out.productId] : out.expectedQtyKg;
                      const rowKey = out.productId != null ? `runner-out-${out.productId}` : `runner-out-${outIdx}`;
                      return (
                        <tr key={rowKey} className="hover:bg-gray-50/50">
                          <td className="p-2.5 font-bold text-gray-900">
                            {out.productName}
                            {out.isPrimary ? (
                              <span className="ml-1 text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">{t('Primary')}</span>
                            ) : (
                              <span className="ml-1 text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded font-bold">{t('By-product')}</span>
                            )}
                          </td>
                          <td className="p-2.5 text-center text-gray-500">
                            {out.expectedQtyKg} kg
                          </td>
                          <td className="p-2.5 text-center">
                            <input
                              type="number"
                              value={safeNumValue(actual)}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                setRunnerOutputActuals({
                                  ...runnerOutputActuals,
                                  [out.productId]: val
                                });
                              }}
                              className="w-24 px-2 py-1 border rounded text-center font-black text-gray-900 bg-emerald-50/60 outline-none"
                            />
                          </td>
                          <td className="p-2.5 text-right font-mono text-gray-600">
                            {formatMoney(out.marketPrice, activeCurrency, activeExchangeRate)}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-indigo-700">
                            {formatMoney(out.unitCost || (out.marketPrice * 0.7), activeCurrency, activeExchangeRate)} / kg
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t">
              <button
                type="button"
                onClick={() => setActiveRunnerRun(null)}
                className="px-4 py-2 border rounded-xl font-bold text-xs text-gray-600 hover:bg-gray-100"
              >
                {t('Close')}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdateBatchRunner('In-Progress')}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
                >
                  {t('Save Progress')}
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateBatchRunner('Quality Check')}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow"
                >
                  <Beaker className="w-4 h-4" /> {t('Send to Quality Control (TBS)')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 4: QC TESTING & LAB PARAMETERS (Enhancement #3) */}
      {/* ------------------------------------------------------------------ */}
      {activeQCRun && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6 space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-purple-50 text-purple-700">
                    <Beaker className="w-5 h-5" />
                  </span>
                  <h3 className="font-black text-base text-gray-900">
                    {t('TBS Laboratory Quality Control Testing')}
                  </h3>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {t('Batch')}: <strong className="text-gray-800 font-mono">{activeQCRun.batchNumber}</strong> · {activeQCRun.bomName}
                </p>
              </div>
              <button onClick={() => setActiveQCRun(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Template Selector */}
            <div className="space-y-1 text-xs">
              <label className="font-bold text-gray-700 uppercase tracking-wider text-[10px] block">
                {t('Select Quality Standard Template (TBS Standard)')}
              </label>
              <select
                value={qcTemplateId}
                onChange={e => setQcTemplateId(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl font-bold bg-gray-50 outline-none"
              >
                {companyTemplates.map((tmpl, tIdx) => (
                  <option key={tmpl.id != null ? String(tmpl.id) : `tmpl-opt-${tIdx}`} value={tmpl.id}>{tmpl.name} ({tmpl.standardRef || 'EAS 44'})</option>
                ))}
              </select>
            </div>

            {/* Numeric Lab Parameters Table */}
            <div className="space-y-2">
              <span className="font-bold text-xs text-gray-700 block">
                {t('Enter Measured Numeric Lab Values')}
              </span>
              <div className="overflow-x-auto border rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">{t('Parameter')}</th>
                      <th className="p-2.5">{t('Standard Range')}</th>
                      <th className="p-2.5 text-center">{t('Measured Lab Value')}</th>
                      <th className="p-2.5 text-center">{t('Status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {activeQCEvaluation.labResults.map((res, rIdx) => (
                      <tr key={res.parameterId != null ? String(res.parameterId) : `res-${rIdx}`} className="hover:bg-gray-50/50">
                        <td className="p-2.5 font-bold text-gray-900">
                          {res.paramName}
                          {res.isCritical && (
                            <span className="ml-1.5 px-1 py-0.2 rounded text-[9px] bg-rose-100 text-rose-800 font-bold uppercase">
                              {t('Critical')}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono text-gray-600">
                          {res.standardMin !== undefined ? res.standardMin : ''} - {res.standardMax !== undefined ? res.standardMax : ''} {res.unit}
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="number"
                            step="0.01"
                            value={safeNumValue(qcLabInputs[res.parameterId])}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              setQcLabInputs({
                                ...qcLabInputs,
                                [res.parameterId]: val
                              });
                            }}
                            className="w-24 px-2 py-1 border rounded text-center font-bold text-gray-900 bg-gray-50 outline-none"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            res.status === 'passed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : res.status === 'failed'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {res.status === 'passed' ? '✓ Passed' : res.status === 'failed' ? '✗ FAILED' : '⚠️ Variance'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Auto-Decision Engine & Inspector Override */}
            <div className={`p-4 rounded-xl border space-y-3 ${
              activeQCEvaluation.autoDecision === 'Passed'
                ? 'bg-emerald-50/60 border-emerald-200'
                : activeQCEvaluation.autoDecision === 'Rejected'
                ? 'bg-rose-50/60 border-rose-200'
                : 'bg-amber-50/60 border-amber-200'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
                    {t('System Automated Decision (TBS Compliance Engine)')}
                  </span>
                  <span className={`text-lg font-black block ${
                    activeQCEvaluation.autoDecision === 'Passed'
                      ? 'text-emerald-700'
                      : activeQCEvaluation.autoDecision === 'Rejected'
                      ? 'text-rose-700'
                      : 'text-amber-700'
                  }`}>
                    {activeQCEvaluation.autoDecision}
                  </span>
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                  <input
                    type="checkbox"
                    checked={qcIsOverridden}
                    onChange={e => setQcIsOverridden(e.target.checked)}
                    className="w-4 h-4 accent-purple-600"
                  />
                  <span>{t('Override Decision')}</span>
                </label>
              </div>

              {qcIsOverridden && (
                <div className="pt-2 border-t space-y-2 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-700">{t('Inspector Decision')}:</span>
                    <select
                      value={qcOverrideDecision}
                      onChange={e => setQcOverrideDecision(e.target.value as any)}
                      className="px-3 py-1 border rounded-lg font-bold bg-white"
                    >
                      <option value="Passed">{t('Passed')}</option>
                      <option value="Passed with Variance">{t('Passed with Variance')}</option>
                      <option value="Rework Required">{t('Rework Required')}</option>
                      <option value="Rejected">{t('Rejected')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">
                      {t('Mandatory Override Explanation (Logged in Audit Trail)')}
                    </label>
                    <input
                      type="text"
                      value={qcOverrideReason}
                      onChange={e => setQcOverrideReason(e.target.value)}
                      placeholder="e.g. Moisture 13.6% acceptable due to dry packaging silo transit"
                      className="w-full px-3 py-1.5 border rounded-lg bg-white outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Signoff & Inspector Details */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">{t('Inspector Name')}</label>
                <input
                  type="text"
                  value={qcInspectorName}
                  onChange={e => setQcInspectorName(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded-lg bg-gray-50 outline-none"
                />
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">{t('Digital Signature / Approval Code')}</label>
                <input
                  type="text"
                  value={qcSignature}
                  onChange={e => setQcSignature(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded-lg bg-gray-50 font-mono outline-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => setActiveQCRun(null)}
                className="px-4 py-2 border rounded-xl font-bold text-xs text-gray-600 hover:bg-gray-100"
              >
                {t('Cancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveQCCheck}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow transition"
              >
                {t('Sign & Certify Quality Slip')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 5: UNIVERSAL QC TEMPLATE EDITOR & LAB PARAMETERS */}
      {/* ------------------------------------------------------------------ */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6 space-y-5 my-8 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200">
                  <Beaker className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-extrabold text-base text-gray-900">
                    {editingTemplateId ? t('Edit Universal QC Standard Template') : t('Create Universal QC Standard Template')}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {t('Configure laboratory testing parameters, thresholds, and criticality for any manufacturing product.')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="text-gray-400 hover:text-gray-600 transition p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Industry Presets */}
            <div className="space-y-1.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                {t('Quick-Start Industry Presets (One-Click Setup)')}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleApplyIndustryPreset('flour')}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 hover:border-amber-300 shadow-2xs transition"
                >
                  🌾 {t('Wheat Flour (TZS 438)')}
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyIndustryPreset('oil')}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 hover:border-amber-300 shadow-2xs transition"
                >
                  🌻 {t('Edible Oil (TZS 53)')}
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyIndustryPreset('soap')}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-800 border border-slate-200 hover:border-indigo-300 shadow-2xs transition"
                >
                  🧼 {t('Toilet Soap (TZS 157)')}
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyIndustryPreset('beverage')}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 shadow-2xs transition"
                >
                  🥤 {t('Fruit Juices (TZS 585)')}
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyIndustryPreset('bakery')}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 hover:border-amber-300 shadow-2xs transition"
                >
                  🍞 {t('Bakery Bread (TZS 102)')}
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyIndustryPreset('plastics')}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-800 border border-slate-200 hover:border-sky-300 shadow-2xs transition"
                >
                  🧪 {t('Rigid PVC (TZS 100)')}
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyIndustryPreset('custom')}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 border border-slate-300 shadow-2xs transition"
                >
                  ⚙️ {t('Custom Blank')}
                </button>
              </div>
            </div>

            {/* Template Profile Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="md:col-span-1">
                <label className="font-bold text-gray-700 block mb-1">
                  {t('Template Name')} *
                </label>
                <input
                  type="text"
                  value={tmplName}
                  onChange={e => setTmplName(e.target.value)}
                  placeholder="e.g. Wheat Flour Grade 1"
                  className="w-full px-3 py-2 border rounded-xl bg-gray-50 font-bold text-gray-900 outline-none focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  {t('Industry Product Category')}
                </label>
                <input
                  type="text"
                  value={tmplCategory}
                  onChange={e => setTmplCategory(e.target.value)}
                  placeholder="e.g. Grain Milling & Flour"
                  className="w-full px-3 py-2 border rounded-xl bg-gray-50 font-medium text-gray-900 outline-none focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  {t('Standard Spec / Regulatory Ref')}
                </label>
                <input
                  type="text"
                  value={tmplStandardRef}
                  onChange={e => setTmplStandardRef(e.target.value)}
                  placeholder="e.g. TZS 438:2021 / EAS 44"
                  className="w-full px-3 py-2 border rounded-xl bg-gray-50 font-mono text-gray-900 outline-none focus:bg-white focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Dynamic Lab Parameters Table */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-gray-900 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                    {t('Lab Quality Control Parameters')} ({tmplParameters.length})
                  </h4>
                  <p className="text-[11px] text-gray-400">
                    {t('Critical parameters automatically trigger batch rejection or rework if out of range.')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddParamRow}
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs flex items-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> {t('Add Parameter')}
                </button>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">{t('Parameter Name')} *</th>
                      <th className="p-2.5 w-24">{t('Unit')}</th>
                      <th className="p-2.5 w-24 text-center">{t('Min Value')}</th>
                      <th className="p-2.5 w-24 text-center">{t('Max Value')}</th>
                      <th className="p-2.5 w-24 text-center">{t('Target (opt)')}</th>
                      <th className="p-2.5 w-28 text-center">{t('Critical?')}</th>
                      <th className="p-2.5 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {tmplParameters.map((param, pIdx) => (
                      <tr key={param.id != null ? String(param.id) : `param-${pIdx}`} className="hover:bg-gray-50/50">
                        <td className="p-2">
                          <input
                            type="text"
                            value={param.paramName}
                            onChange={e => {
                              const val = e.target.value;
                              setTmplParameters(prev => prev.map((p, i) => i === pIdx ? { ...p, paramName: val } : p));
                            }}
                            placeholder="e.g. Moisture Content"
                            className="w-full px-2.5 py-1 border rounded-lg bg-white font-bold text-gray-900 outline-none text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={param.unit}
                            onChange={e => {
                              const val = e.target.value;
                              setTmplParameters(prev => prev.map((p, i) => i === pIdx ? { ...p, unit: val } : p));
                            }}
                            placeholder="%, pH, ppm"
                            className="w-full px-2 py-1 border rounded-lg bg-white font-mono text-center text-xs outline-none"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="any"
                            value={safeNumValue(param.minValue)}
                            onChange={e => {
                              const raw = e.target.value;
                              const val = raw === '' ? undefined : (parseFloat(raw) || 0);
                              setTmplParameters(prev => prev.map((p, i) => i === pIdx ? { ...p, minValue: val } : p));
                            }}
                            placeholder="Min"
                            className="w-full px-2 py-1 border rounded-lg bg-white font-mono text-center text-xs outline-none"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="any"
                            value={safeNumValue(param.maxValue)}
                            onChange={e => {
                              const raw = e.target.value;
                              const val = raw === '' ? undefined : (parseFloat(raw) || 0);
                              setTmplParameters(prev => prev.map((p, i) => i === pIdx ? { ...p, maxValue: val } : p));
                            }}
                            placeholder="Max"
                            className="w-full px-2 py-1 border rounded-lg bg-white font-mono text-center text-xs outline-none"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="any"
                            value={safeNumValue(param.targetValue)}
                            onChange={e => {
                              const raw = e.target.value;
                              const val = raw === '' ? undefined : (parseFloat(raw) || 0);
                              setTmplParameters(prev => prev.map((p, i) => i === pIdx ? { ...p, targetValue: val } : p));
                            }}
                            placeholder="Opt"
                            className="w-full px-2 py-1 border rounded-lg bg-white font-mono text-center text-xs outline-none"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <label className="inline-flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(param.isCritical)}
                              onChange={e => {
                                const checked = e.target.checked;
                                setTmplParameters(prev => prev.map((p, i) => i === pIdx ? { ...p, isCritical: checked } : p));
                              }}
                              className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                            />
                            <span className={`text-[10px] font-bold uppercase ${param.isCritical ? 'text-rose-700' : 'text-gray-400'}`}>
                              {param.isCritical ? t('Critical') : t('Standard')}
                            </span>
                          </label>
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveParamRow(pIdx)}
                            className="p-1 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title={t('Remove parameter')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="px-4 py-2 border rounded-xl font-bold text-xs text-gray-600 hover:bg-gray-100"
              >
                {t('Cancel')}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
                >
                  <CheckSquare className="w-4 h-4" />
                  {editingTemplateId ? t('Update QC Template') : t('Save QC Template')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 6: PRINTABLE TRAVELER & TBS COMPLIANCE SLIP */}
      {/* ------------------------------------------------------------------ */}
      {travelerRun && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-8 space-y-6 my-8 max-h-[95vh] overflow-y-auto print:m-0 print:p-4 print:shadow-none print:w-full print:max-w-none">
            {/* Header with TBS Badge placeholder */}
            <div className="flex items-start justify-between border-b pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black">
                    <Factory className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-950 uppercase tracking-tight">
                      {companies.find(c => c.id === currentCompanyId)?.name || 'TradeCore Food & Agro Industries'}
                    </h2>
                    <span className="text-xs text-gray-500 font-semibold block">
                      {t('Batch Traveler & TBS Certificate of Quality Compliance (EAS 44:2019)')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>TBS COMPLIANCE CERTIFIED</span>
                </div>
                <span className="text-[10px] text-gray-400 font-mono">
                  Cert No: TBS-QC-{travelerRun.batchNumber}
                </span>
              </div>
            </div>

            {/* Batch & Product Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-gray-50 border text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 block">{t('Batch Number')}</span>
                <span className="font-mono font-extrabold text-gray-900">{travelerRun.batchNumber}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 block">{t('Run Order #')}</span>
                <span className="font-mono font-bold text-gray-700">{travelerRun.runNumber}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 block">{t('Production Date')}</span>
                <span className="font-bold text-gray-900">{travelerRun.completedDate || travelerRun.plannedStartDate}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 block">{t('Best Before / Expiry')}</span>
                <span className="font-bold text-gray-900">{travelerRun.expiryDate || 'N/A'}</span>
              </div>
            </div>

            {/* Weight, Yield & Loss Balance Summary */}
            <div className="space-y-2">
              <h4 className="font-bold text-xs text-gray-700 uppercase tracking-wider">{t('Production Mass Balance & Yield Breakdown')}</h4>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-3 bg-gray-50 rounded-xl border">
                  <span className="text-[10px] text-gray-400 font-bold block">{t('Raw Weighed Grain')}</span>
                  <span className="font-black text-gray-900 text-sm mt-0.5 block">{travelerRun.inputWeightKg} kg</span>
                </div>
                <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200">
                  <span className="text-[10px] text-amber-700 font-bold block">{t('Cleaning Loss')}</span>
                  <span className="font-black text-amber-800 text-sm mt-0.5 block">{travelerRun.cleaningLossKg} kg</span>
                </div>
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200">
                  <span className="text-[10px] text-blue-700 font-bold block">{t('Moisture Invisible Loss')}</span>
                  <span className="font-black text-blue-800 text-sm mt-0.5 block">{travelerRun.invisibleLossKg.toFixed(1)} kg</span>
                </div>
                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-emerald-700 font-bold block">{t('Total Usable Outputs')}</span>
                  <span className="font-black text-emerald-800 text-sm mt-0.5 block">{travelerRun.totalOutputKg} kg</span>
                </div>
              </div>
            </div>

            {/* Output Finished Goods Table */}
            <div className="space-y-2">
              <h4 className="font-bold text-xs text-gray-700 uppercase tracking-wider">{t('Produced Inventory Lots & Unit Costs')}</h4>
              <table className="w-full text-left text-xs border rounded-xl overflow-hidden">
                <thead className="bg-gray-100 text-gray-600 font-bold text-[10px] uppercase">
                  <tr>
                    <th className="p-2.5">{t('Product Name')}</th>
                    <th className="p-2.5 text-center">{t('Classification')}</th>
                    <th className="p-2.5 text-center">{t('Actual Output (kg)')}</th>
                    <th className="p-2.5 text-right">{t('Allocated Cost / kg')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {travelerRun.outputs.map((out, outIdx) => (
                    <tr key={out.productId != null ? `traveler-out-${out.productId}` : `traveler-out-${outIdx}`}>
                      <td className="p-2.5 font-bold text-gray-900">{out.productName}</td>
                      <td className="p-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          out.isPrimary ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {out.isPrimary ? t('Primary Finished Good') : t('By-Product')}
                        </span>
                      </td>
                      <td className="p-2.5 text-center font-bold text-gray-800">{out.actualQtyKg} kg</td>
                      <td className="p-2.5 text-right font-mono font-bold text-indigo-700">
                        {formatMoney(out.unitCost, activeCurrency, activeExchangeRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Traceability QR Code & Digital Signature */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-4 border-t">
              <div className="flex items-center gap-4">
                {travelerQrUrl ? (
                  <img src={travelerQrUrl} alt="Traceability QR" className="w-24 h-24 border rounded-xl p-1 bg-white shadow-xs" />
                ) : (
                  <div className="w-24 h-24 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
                    <QrCode className="w-10 h-10" />
                  </div>
                )}
                <div className="space-y-1 text-xs">
                  <span className="font-extrabold text-gray-900 block">{t('Genealogy & Lot Traceability')}</span>
                  <p className="text-[11px] text-gray-500 max-w-xs leading-relaxed">
                    {t('Scan QR code to trace grain harvest lot, milling parameters, lab assay records, and warehouse receipt.')}
                  </p>
                </div>
              </div>

              <div className="text-right space-y-1 text-xs">
                <span className="font-bold text-gray-400 uppercase text-[10px] block">{t('Certified Quality Inspector')}</span>
                <span className="font-bold text-gray-900 block">J. M. Mkude, Lead QC Officer</span>
                <span className="text-[11px] font-mono text-emerald-700 block">SIGN-VERIFIED: TBS/EAS/2026/094</span>
                <span className="text-[10px] text-gray-400 block">{new Date().toISOString().slice(0, 10)}</span>
              </div>
            </div>

            {/* Non-print controls */}
            <div className="flex items-center justify-between pt-4 border-t no-print">
              <button
                type="button"
                onClick={() => setTravelerRun(null)}
                className="px-4 py-2 border rounded-xl font-bold text-xs text-gray-600 hover:bg-gray-100"
              >
                {t('Close')}
              </button>
              <button
                type="button"
                onClick={handlePrintTraveler}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow"
              >
                <Printer className="w-4 h-4" /> {t('Print Official Traveler / TBS Slip')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 7: CHRONOLOGICAL PRODUCTION ORDER AUDIT TRAIL TIMELINE */}
      {/* ------------------------------------------------------------------ */}
      {activeAuditRun && (() => {
        const runLogs = (productionAuditLogs || [])
          .filter(log => log.productionRunId === activeAuditRun.id || log.batchNumber === activeAuditRun.batchNumber)
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        const filteredLogs = auditFilterType === 'ALL'
          ? runLogs
          : auditFilterType === 'STATUS_CHANGE'
          ? runLogs.filter(l => l.action === 'STATUS_CHANGE' || l.action === 'RUN_CREATED' || l.action === 'RUN_COMPLETED')
          : auditFilterType === 'MATERIAL_USAGE'
          ? runLogs.filter(l => l.action === 'MATERIAL_USAGE')
          : auditFilterType === 'QC_OVERRIDE'
          ? runLogs.filter(l => l.action === 'QC_OVERRIDE' || l.action === 'QC_INSPECTION')
          : runLogs;

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6 space-y-6 my-8 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-start justify-between border-b pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
                      <History className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="font-extrabold text-base text-gray-900">
                        {t('Production Order Chronological Audit Trail')}
                      </h3>
                      <p className="text-xs text-gray-400">
                        {t('Immutable historical log of batch progression, recipe changes, loss calibrations, and QC override decisions.')}
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setActiveAuditRun(null)}
                  className="text-gray-400 hover:text-gray-600 transition p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Batch Context Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">{t('Batch Number')}</span>
                  <span className="font-mono font-extrabold text-indigo-700">{activeAuditRun.batchNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">{t('Order Number')}</span>
                  <span className="font-mono font-bold text-gray-800">{activeAuditRun.runNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">{t('BOM Recipe')}</span>
                  <span className="font-bold text-gray-900 truncate block">{activeAuditRun.bomName}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">{t('Current Status')}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-white inline-block">
                    {activeAuditRun.status}
                  </span>
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-2 border-b pb-3 overflow-x-auto text-xs">
                <button
                  type="button"
                  onClick={() => setAuditFilterType('ALL')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                    auditFilterType === 'ALL'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t('All Audit Events')} ({runLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAuditFilterType('STATUS_CHANGE')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                    auditFilterType === 'STATUS_CHANGE'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  {t('Status Changes')}
                </button>
                <button
                  type="button"
                  onClick={() => setAuditFilterType('MATERIAL_USAGE')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                    auditFilterType === 'MATERIAL_USAGE'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  {t('Loss & Material Usage')}
                </button>
                <button
                  type="button"
                  onClick={() => setAuditFilterType('QC_OVERRIDE')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                    auditFilterType === 'QC_OVERRIDE'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  {t('QC Lab & Overrides')}
                </button>
              </div>

              {/* Timeline Items */}
              {filteredLogs.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400 italic bg-gray-50 rounded-2xl border border-dashed border-gray-200 space-y-2">
                  <Clock className="w-8 h-8 text-gray-300 mx-auto" />
                  <p>{t('No audit records found matching this filter for Batch')} {activeAuditRun.batchNumber}.</p>
                  <p className="text-[11px] text-gray-400">
                    {t('New activities, status progressions, and QC overrides are logged in real-time with full user attribution.')}
                  </p>
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-indigo-100">
                  {filteredLogs.map((log, lIdx) => {
                    const isStatus = log.action === 'STATUS_CHANGE' || log.action === 'RUN_CREATED' || log.action === 'RUN_COMPLETED';
                    const isMaterial = log.action === 'MATERIAL_USAGE';
                    const isQcOverride = log.action === 'QC_OVERRIDE';
                    const isQcInspect = log.action === 'QC_INSPECTION';

                    return (
                      <div key={log.id != null ? String(log.id) : `audit-log-${lIdx}`} className="relative group">
                        {/* Timeline Node Icon */}
                        <div className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 bg-white flex items-center justify-center ${
                          isQcOverride
                            ? 'border-rose-500 text-rose-600 ring-2 ring-rose-100'
                            : isStatus
                            ? 'border-indigo-600 text-indigo-600'
                            : isMaterial
                            ? 'border-amber-500 text-amber-600'
                            : 'border-purple-600 text-purple-600'
                        }`}>
                          {isQcOverride ? (
                            <AlertTriangle className="w-3 h-3" />
                          ) : isStatus ? (
                            <ArrowRight className="w-3 h-3" />
                          ) : isMaterial ? (
                            <Layers className="w-3 h-3" />
                          ) : (
                            <Beaker className="w-3 h-3" />
                          )}
                        </div>

                        {/* Content Card */}
                        <div className={`p-4 rounded-xl border text-xs space-y-2 transition shadow-2xs ${
                          isQcOverride
                            ? 'bg-rose-50/40 border-rose-200'
                            : isStatus
                            ? 'bg-slate-50/70 border-slate-200'
                            : isMaterial
                            ? 'bg-amber-50/30 border-amber-200'
                            : 'bg-purple-50/30 border-purple-200'
                        }`}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                isQcOverride
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                  : isStatus
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : isMaterial
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}>
                                {log.action.replace('_', ' ')}
                              </span>
                              <span className="font-bold text-gray-900">
                                {log.userName || log.performedBy || 'System'}
                              </span>
                              {log.userRole && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-gray-200 text-gray-700">
                                  {log.userRole}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-gray-400 font-mono">
                              <Clock className="w-3 h-3" />
                              <span>{new Date(log.timestamp).toLocaleString()}</span>
                            </div>
                          </div>

                          <p className="text-gray-700 font-medium leading-relaxed">
                            {log.details}
                          </p>

                          {/* Metadata Badges */}
                          {log.metadata && (
                            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-200/60 text-[11px]">
                              {log.previousStatus && log.newStatus && (
                                <div className="flex items-center gap-1 font-mono font-bold">
                                  <span className="text-gray-500">{log.previousStatus}</span>
                                  <span>➜</span>
                                  <span className="text-indigo-700">{log.newStatus}</span>
                                </div>
                              )}
                              {log.metadata.cleaningLossKg !== undefined && (
                                <span className="px-2 py-0.5 rounded bg-amber-100/80 text-amber-900 font-medium">
                                  {t('Cleaning Loss')}: <strong>{log.metadata.cleaningLossKg} kg</strong>
                                </span>
                              )}
                              {log.metadata.invisibleLossKg !== undefined && (
                                <span className="px-2 py-0.5 rounded bg-blue-100/80 text-blue-900 font-medium">
                                  {t('Invisible Loss')}: <strong>{Number(log.metadata.invisibleLossKg).toFixed(1)} kg</strong> ({Number(log.metadata.invisibleLossPercent || 0).toFixed(2)}%)
                                </span>
                              )}
                              {log.metadata.moistureBeforePercent !== undefined && (
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-medium">
                                  {t('Moisture')}: {log.metadata.moistureBeforePercent}% ➜ {log.metadata.moistureAfterPercent}%
                                </span>
                              )}
                              {log.metadata.qcAutoDecision && (
                                <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-800 font-medium">
                                  {t('Auto Decision')}: <strong>{log.metadata.qcAutoDecision}</strong>
                                </span>
                              )}
                              {log.metadata.qcFinalDecision && (
                                <span className={`px-2 py-0.5 rounded font-bold ${
                                  log.metadata.qcFinalDecision === 'Passed'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : log.metadata.qcFinalDecision === 'Rejected'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {t('Final Decision')}: {log.metadata.qcFinalDecision}
                                </span>
                              )}
                              {log.metadata.qcOverrideReason && (
                                <div className="w-full mt-1 p-2 rounded bg-rose-100/70 text-rose-900 text-[11px] font-medium border border-rose-200">
                                  <strong>{t('Override Justification')}:</strong> "{log.metadata.qcOverrideReason}"
                                </div>
                              )}
                              {log.metadata.signature && (
                                <span className="font-mono text-gray-500 text-[10px]">
                                  Sig: {log.metadata.signature}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Close Button */}
              <div className="flex items-center justify-end pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setActiveAuditRun(null)}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
                >
                  {t('Close Audit View')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Safe Action & Deletion Confirmation Modal */}
      <ConfirmActionModal
        isOpen={confirmModalState.isOpen}
        onClose={() => setConfirmModalState(s => ({ ...s, isOpen: false }))}
        onConfirm={confirmModalState.onConfirm}
        title={confirmModalState.title}
        description={confirmModalState.description}
        confirmText={confirmModalState.confirmText || t('Delete')}
        cancelText={confirmModalState.cancelText || t('Cancel')}
      />
    </div>
  );
}
