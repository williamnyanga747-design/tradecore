#!/usr/bin/env python3
"""
Populates missing translations in src/utils/format.ts across all 4 languages:
- englishDict (en)
- swahiliDict (sw)
- frenchDict (fr)
- spanishDict (es)
"""
import json
import re
import sys
import os

with open('scripts/audit-report.json', 'r', encoding='utf-8') as f:
    audit_data = json.load(f)

missing = audit_data.get('missing', {})
en_swahili_keys = missing.get('en_swahili', [])
sw_english_keys = missing.get('sw_english_source', [])
fr_keys = missing.get('fr', [])
es_keys = missing.get('es', [])

print(f"Loaded audit report. Missing: EN: {len(en_swahili_keys)}, SW: {len(sw_english_keys)}, FR: {len(fr_keys)}, ES: {len(es_keys)}")

# Common phrase glossary for ERP, Manufacturing, Retail, and Marketplace
GLOSSARY = {
    # System & Auth
    "Admin pekee ndiye anayewasha Lipa Pole Pole": {
        "en": "Only Admin can activate Installment Payments (Lipa Pole Pole)",
        "fr": "Seul l'administrateur peut activer le paiement échelonné",
        "es": "Solo el administrador puede activar el pago en cuotas"
    },
    "Agizo halikupatikana.": {
        "en": "Order not found.",
        "fr": "Commande introuvable.",
        "es": "Pedido no encontrado."
    },
    "Agizo hili tayari lina wakala aliyeunganishwa.": {
        "en": "This order already has an assigned agent.",
        "fr": "Cette commande a déjà un agent assigné.",
        "es": "Este pedido ya tiene un agente asignado."
    },
    "Akaunti yako bado haijathibitishwa na Msimamizi Mkuu (Super Admin). Tafadhali subiri idhini kabla ya kuingia.": {
        "en": "Your account has not yet been verified by the Super Admin. Please wait for approval before signing in.",
        "fr": "Votre compte n'a pas encore été vérifié par le Super Administrateur. Veuillez attendre l'approbation avant de vous connecter.",
        "es": "Su cuenta aún no ha sido verificada por el Super Administrador. Espere la aprobación antes de iniciar sesión."
    },
    "Alika Wenzako Wachangie Kiasi Kilichobaki": {
        "en": "Invite Friends to Contribute the Remaining Amount",
        "fr": "Invitez des amis à contribuer au montant restant",
        "es": "Invita a amigos a contribuir con el monto restante"
    },
    "Andika Kiasi Unacholipa Kupunguza Bei ya Bidhaa": {
        "en": "Enter the Amount You Pay to Reduce the Product Price",
        "fr": "Entrez le montant que vous payez pour réduire le prix",
        "es": "Ingrese el monto que paga para reducir el precio del producto"
    },
    "Andika Kiasi Unacholipa Wewe (Custom Amount)": {
        "en": "Enter Your Contribution Amount (Custom Amount)",
        "fr": "Entrez votre montant de contribution (Montant personnalisé)",
        "es": "Ingrese el monto de su contribución (Monto personalizado)"
    },
    "Andika ujumbe kwa mteja...": {
        "en": "Write a message to the customer...",
        "fr": "Écrire un message au client...",
        "es": "Escribe un mensaje al cliente..."
    },
    "Angalia Kampuni": {
        "en": "View Company",
        "fr": "Voir l'entreprise",
        "es": "Ver empresa"
    },
    "Anwani ya Mteja (Delivery Destination)": {
        "en": "Customer Address (Delivery Destination)",
        "fr": "Adresse du client (Destination de livraison)",
        "es": "Dirección del cliente (Destino de entrega)"
    },
    "Anza Mazungumzo na Muuzaji": {
        "en": "Start Conversation with Seller",
        "fr": "Démarrer la conversation avec le vendeur",
        "es": "Iniciar conversación con el vendedor"
    },
    "Anzisha Kikundi & Lipa": {
        "en": "Start Group & Pay",
        "fr": "Créer un groupe et payer",
        "es": "Iniciar grupo y pagar"
    },
    "Anzisha Kikundi Changu Sasa": {
        "en": "Start My Group Now",
        "fr": "Créer mon groupe maintenant",
        "es": "Iniciar mi grupo ahora"
    },
    "Anzisha Kikundi Sasa": {
        "en": "Start Group Now",
        "fr": "Créer le groupe maintenant",
        "es": "Iniciar grupo ahora"
    },
    "Anzisha Lipa Pole Pole & Thibitisha Awali ya": {
        "en": "Start Installment Payment & Confirm Initial Deposit",
        "fr": "Démarrer le paiement échelonné et confirmer l'acompte initial",
        "es": "Iniciar pago en cuotas y confirmar depósito inicial"
    },
    "Anzisha Live Stream Sasa": {
        "en": "Start Live Stream Now",
        "fr": "Démarrer le flux en direct maintenant",
        "es": "Iniciar transmisión en vivo ahora"
    },
    "Anzisha Nunua Pamoja (Group Buy)": {
        "en": "Start Group Buy",
        "fr": "Démarrer un achat groupé",
        "es": "Iniciar compra en grupo"
    },
    "Anzisha Nunua Pamoja Mpya": {
        "en": "Start New Group Buy",
        "fr": "Démarrer un nouvel achat groupé",
        "es": "Iniciar nueva compra grupal"
    },
    "Anzisha kikundi chako mwenyewe na waalike ndugu au marafiki upate punguzo kubwa!": {
        "en": "Start your own group and invite friends or family to unlock big discounts!",
        "fr": "Créez votre propre groupe et invitez amis ou famille pour débloquer de grosses réductions !",
        "es": "¡Crea tu propio grupo e invita a amigos o familiares para obtener grandes descuentos!"
    },
    "Anzisha live shopping ili kuungana moja kwa moja na wateja wako.": {
        "en": "Start live shopping to connect directly with your customers in real time.",
        "fr": "Démarrez le shopping en direct pour communiquer directement avec vos clients.",
        "es": "Inicia compras en vivo para conectarte directamente con tus clientes."
    },
    "Arifa hizi zinatoka kwa wateja nje ya mfumo (Marketplace).": {
        "en": "These notifications originate from customers outside the system (Marketplace).",
        "fr": "Ces notifications proviennent de clients externes au système (Marketplace).",
        "es": "Estas notificaciones provienen de clientes fuera del sistema (Marketplace)."
    },
    "Arifa za Mfanyabiashara": {
        "en": "Merchant Notifications",
        "fr": "Notifications commerçant",
        "es": "Notificaciones del comerciante"
    },
    "Badilisha Namba": {
        "en": "Change Number",
        "fr": "Changer de numéro",
        "es": "Cambiar número"
    },
    "Badilisha bidhaa unayoulizia": {
        "en": "Change the product you are inquiring about",
        "fr": "Changer le produit concerné par votre demande",
        "es": "Cambiar el producto sobre el que consulta"
    },
    "Baada ya muuzaji kuthibitisha malipo ya mnunuzi (Verify Payment), kamisheni hii itaingizwa moja kwa moja kwenye salio la wakala.": {
        "en": "Once the seller verifies buyer payment, this commission will be credited directly to the agent balance.",
        "fr": "Une fois que le vendeur confirme le paiement de l'acheteur, cette commission est créditée directement sur le solde de l'agent.",
        "es": "Una vez que el vendedor verifique el pago del comprador, esta comisión se acreditará directamente al saldo del agente."
    }
}

# Vocabulary maps for procedural translation
EN_TO_SW = {
    "Production Orders & Batch Runs": "Maagizo ya Uzalishaji na Makundi ya Batch",
    "Production Runs & Batches": "Makundi ya Uzalishaji na Batches",
    "Work Needed": "Kazi Inayohitajika",
    "Work Available": "Kazi Inayopatikana",
    "All Orders": "Maagizo Yote",
    "Batches Producible": "Batches Zinazoweza Kuzalishwa",
    "Batches Available from Stock": "Batches Zinazopatikana Kutoka Stoo",
    "Active In-Flight": "Inayoendelea Kwenye Uzalishaji",
    "Active Orders": "Maagizo Yaliyo Kazini",
    "Insufficient Raw Materials": "Malighafi Hazitoshi",
    "Low Raw Materials": "Malighafi Ziko Chini",
    "Warehouse Parts Availability": "Upatikanaji wa Malighafi Ghala",
    "In-Flight Batches": "Batches Zinazoendelea",
    "Delete Bill of Materials Recipe": "Futa Kichocheo cha BOM",
    "Delete BOM Recipe": "Futa Kichocheo cha BOM",
    "Delete Production Batch Run": "Futa Batch ya Uzalishaji",
    "Delete Production Order": "Futa Agizo la Uzalishaji",
    "Delete Order": "Futa Agizo",
    "Delete Recipe": "Futa Kichocheo",
    "Delete QC Standard Template": "Futa Kiolezo cha Viwango vya QC",
    "Start Now (In-Progress)": "Anza Sasa (Inaendelea)",
    "Schedule (Planned)": "Panga Ratiba (Imepangwa)",
    "Production Execution Mode": "Mfumo wa Utekelezaji wa Uzalishaji",
    "Immediately deducts parts from warehouse stock": "Inapunguza malighafi kutoka stoo mara moja",
    "Leaves parts in inventory until batch starts": "Inaacha malighafi ghalani hadi uzalishaji unapoanza",
    "Parts to be Consumed from Warehouse": "Malighafi Zitakazotumika Kutoka Ghala",
    "Start Batch & Deduct Stock": "Anza Batch na Punguza Stoo",
    "Schedule Production Order": "Panga Agizo la Uzalishaji",
    "QC Variance Alert: Proceed with Stocking?": "Tahadhari ya QC: Endelea Kuweka Stoo?",
    "Proceed & Stock Anyway": "Endelea na Weka Stoo Hata Hivyo",
    "No production orders matching selected filter.": "Hakuna maagizo ya uzalishaji yanayolingana na kichujio kilichochaguliwa.",
    "BOM Recipe Builder": "Mjenzi wa Mapishi ya BOM",
    "BOM recipe deleted": "Kichocheo cha BOM kimefutwa",
    "Production Batch Started": "Batch ya Uzalishaji Imeanza",
    "Production Batch Planned": "Batch ya Uzalishaji Imepangwa",
    "Production Order Planned": "Agizo la Uzalishaji Limepangwa",
    "Batch & Run #": "Namba ya Batch na Run",
    "Target Warehouse": "Ghala Lengwa",
    "Planned Input": "Kiasi Kilichopangwa Kuingizwa",
    "Outputs (Yield)": "Mazao (Mavuno)",
    "TBS QC Result": "Matokeo ya TBS QC",
    "Start Batch": "Anza Batch",
    "Live Runner": "Uzalishaji Mubashara",
    "QC Lab Test": "Vipimo vya Maabara ya QC",
    "Complete & Stock": "Kamilisha na Weka Stoo",
    "Production Order Audit Trail & Timeline": "Mfuatano wa Ukaguzi wa Agizo la Uzalishaji",
    "Print Batch Traveler & TBS Slip": "Chapisha Hati ya Usafiri wa Batch na TBS",
    "products stocked": "bidhaa zimewekwa stoo",
    "Joint Product & Multi-Output BOM Recipes": "Mapishi ya BOM ya Mazao Mchanganyiko na Mazao ya Ziada",
    "Multi-output recipe builder supporting flour, semolina, bran, packaging, and automatic joint-cost allocation.": "Mjenzi wa mapishi ya mazao mengi unayounga mkono unga, semolina, pumba, vifungashio, na ugawaji wa gharama za pamoja.",
    "Create New Multi-Output BOM": "Tengeneza BOM Mpya ya Mazao Mengi",
    "Base Batch Input": "Kipimo cha Msingi cha Kuingiza",
    "Total Estimated Cost": "Jumla ya Gharama Zilizokadiriwa",
    "Raw Materials": "Malighafi",
    "ingredients": "viungo",
    "Outputs (Co-Products & By-Products)": "Mazao (Mazao Makuu na ya Ziada)",
    "Edit Recipe": "Hariri Kichocheo",
    "Delete Recipe": "Futa Kichocheo",
    "Plan Production Order / Batch": "Panga Agizo la Uzalishaji / Batch",
    "Select BOM Recipe": "Chagua Kichocheo cha BOM",
    "Batch Number": "Namba ya Batch",
    "Raw Input Weight (kg)": "Uzito wa Malighafi (kg)",
    "Planned Date": "Tarehe Iliyopangwa",
    "Target Expiry Date": "Tarehe ya Mwisho wa Matumizi",
    "Target Production Warehouse / Depot": "Ghala Lengwa la Uzalishaji",
    "Operational Notes / Shift": "Maelezo ya Uendeshaji / Zamu",
    "Confirm Production Order": "Thibitisha Agizo la Uzalishaji",
    "Cancel": "Ghairi",
    "Delete": "Futa",
    "Save": "Hifadhi",
    "Filter": "Chuja",
    "All": "Yote",
    "Planned": "Imepangwa",
    "In-Progress": "Inaendelea",
    "Quality Check": "Ukaguzi wa Ubora",
    "Completed": "Imekamilika",
    "Passed": "Imefaulu",
    "Rejected": "Imekataliwa",
    "Passed with Variance": "Imefaulu kwa Tofauti",
    "Rework Required": "Inahitaji Kurudiwa",
    "Standard Input": "Kipimo cha Kawaida",
    "Actual Input": "Kipimo Halisi Kilichowekwa",
    "Cleaning Loss": "Upotevu wa Usafishaji",
    "Invisible Loss": "Upotevu Usioonekana (Uvukizi)",
    "Usable Output": "Mazao Yanayotumika",
    "Total Yield": "Jumla ya Mavuno (%)",
    "Variance Evaluation": "Tathmini ya Tofauti",
    "Only Company Admin has permission to delete BOM recipes.": "Admin wa Kampuni pekee ndiye mwenye ruhusa ya kufuta mapishi ya BOM.",
    "Only Company Admin has permission to delete production orders.": "Admin wa Kampuni pekee ndiye mwenye ruhusa ya kufuta maagizo ya uzalishaji.",
    "Only Company Admin has permission to delete QC templates.": "Admin wa Kampuni pekee ndiye mwenye ruhusa ya kufuta violezo vya QC.",
    "Only Company Admin has permission to create new QC templates.": "Admin wa Kampuni pekee ndiye mwenye ruhusa ya kuunda violezo vipya vya QC.",
    "Production Batch Started into live production runner. Raw materials consumed.": "Batch ya uzalishaji imeanza kwenye mfumo. Malighafi zimetumika.",
    "Production Batch Completed & Stocked": "Batch ya Uzalishaji Imekamilika na Kuwekwa Stoo",
    "Inspector Overrode QC Decision": "Mkaguzi Alibadilisha Uamuzi wa QC",
    "Quality Control Lab Inspection Certified": "Ukaguzi wa Maabara ya Ubora Umethibitishwa",
    "Auto-Calculated Invisible Loss (Moisture Evaporation)": "Upotevu Usioonekana Uliokokotolewa Kiotomatiki (Uvukizi wa Unyevu)",
    "Actual Output Yield Weighed & Unit Cost Allocation": "Mavuno Halisi Yaliyopimwa na Ugawaji wa Gharama ya Kizio",
    "Allocates the total batch cost across multiple finished products and bran.": "Hugawa jumla ya gharama ya batch kwa bidhaa za mwisho na pumba.",
    "Avg Invisible Loss %": "Wastani wa Upotevu Usioonekana %",
    "BOM Code": "Msimbo wa BOM",
    "BOM Recipe": "Kichocheo cha BOM",
    "Base Batch Input (kg)": "Kipimo cha Msingi cha Kuingiza (kg)",
    "Batch #": "Namba ya Batch",
    "Batch Traveler": "Hati ya Safari ya Batch",
    "TBS Lab Quality Standard": "Kiwango cha Ubora cha Maabara ya TBS",
    "Cleaning Loss (kg)": "Upotevu wa Usafishaji (kg)",
    "Milling Scrap (kg)": "Mabaki ya Kusaga (kg)",
    "Moisture Before Milling (%)": "Unyevu Kabla ya Kusaga (%)",
    "Moisture After Milling (%)": "Unyevu Baada ya Kusaga (%)"
}

EN_TO_FR = {
    "Production Orders & Batch Runs": "Ordres de fabrication et lots de production",
    "Production Runs & Batches": "Lots et ordres de fabrication",
    "Work Needed": "Travail requis",
    "Work Available": "Travail disponible",
    "All Orders": "Toutes les commandes",
    "Batches Producible": "Lots réalisables",
    "Batches Available from Stock": "Lots disponibles en stock",
    "Active In-Flight": "En cours de fabrication",
    "Active Orders": "Commandes actives",
    "Insufficient Raw Materials": "Matières premières insuffisantes",
    "Low Raw Materials": "Stock de matières faible",
    "Warehouse Parts Availability": "Disponibilité des matières en entrepôt",
    "In-Flight Batches": "Lots en cours de production",
    "Delete Bill of Materials Recipe": "Supprimer la recette de nomenclature (BOM)",
    "Delete BOM Recipe": "Supprimer la recette BOM",
    "Delete Production Batch Run": "Supprimer le lot de fabrication",
    "Delete Production Order": "Supprimer l'ordre de fabrication",
    "Delete Order": "Supprimer l'ordre",
    "Delete Recipe": "Supprimer la recette",
    "Delete QC Standard Template": "Supprimer le modèle de norme CQ",
    "Start Now (In-Progress)": "Démarrer maintenant (En cours)",
    "Schedule (Planned)": "Planifier (Prévu)",
    "Production Execution Mode": "Mode d'exécution de la production",
    "Immediately deducts parts from warehouse stock": "Déduit immédiatement les matières du stock d'entrepôt",
    "Leaves parts in inventory until batch starts": "Conserve les matières en stock jusqu'au lancement du lot",
    "Parts to be Consumed from Warehouse": "Matières à consommer de l'entrepôt",
    "Start Batch & Deduct Stock": "Lancer le lot et déduire le stock",
    "Schedule Production Order": "Planifier l'ordre de fabrication",
    "QC Variance Alert: Proceed with Stocking?": "Alerte de variance CQ : Poursuivre le stockage ?",
    "Proceed & Stock Anyway": "Poursuivre et stocker malgré tout",
    "No production orders matching selected filter.": "Aucun ordre de fabrication ne correspond au filtre sélectionné.",
    "BOM Recipe Builder": "Générateur de recettes BOM",
    "BOM recipe deleted": "Recette BOM supprimée avec succès",
    "Production Batch Started": "Lot de fabrication démarré",
    "Production Batch Planned": "Lot de fabrication planifié",
    "Production Order Planned": "Ordre de fabrication planifié",
    "Batch & Run #": "N° de lot et série",
    "Target Warehouse": "Entrepôt cible",
    "Planned Input": "Matière brute prévue",
    "Outputs (Yield)": "Rendement de sortie",
    "TBS QC Result": "Résultat CQ / TBS",
    "Start Batch": "Lancer le lot",
    "Live Runner": "Suivi en direct",
    "QC Lab Test": "Test laboratoire CQ",
    "Complete & Stock": "Finaliser et stocker",
    "Production Order Audit Trail & Timeline": "Piste d'audit et historique de fabrication",
    "Print Batch Traveler & TBS Slip": "Imprimer la fiche suiveuse et bordereau TBS",
    "products stocked": "produits stockés",
    "Joint Product & Multi-Output BOM Recipes": "Recettes BOM multi-sorties et sous-produits",
    "Multi-output recipe builder supporting flour, semolina, bran, packaging, and automatic joint-cost allocation.": "Concepteur de recettes multi-sorties avec allocation automatique des coûts conjoints.",
    "Create New Multi-Output BOM": "Créer une nouvelle nomenclature multi-sorties",
    "Base Batch Input": "Charge initiale du lot",
    "Total Estimated Cost": "Coût total estimé",
    "Raw Materials": "Matières premières",
    "ingredients": "ingrédients",
    "Outputs (Co-Products & By-Products)": "Sorties (Co-produits et sous-produits)",
    "Edit Recipe": "Modifier la recette",
    "Delete Recipe": "Supprimer la recette",
    "Plan Production Order / Batch": "Planifier un ordre de fabrication / lot",
    "Select BOM Recipe": "Sélectionner la recette BOM",
    "Batch Number": "Numéro de lot",
    "Raw Input Weight (kg)": "Poids brut entrant (kg)",
    "Planned Date": "Date prévue",
    "Target Expiry Date": "Date limite de consommation",
    "Target Production Warehouse / Depot": "Entrepôt de production cible",
    "Operational Notes / Shift": "Notes opérationnelles / Équipe",
    "Confirm Production Order": "Confirmer l'ordre de fabrication",
    "Cancel": "Annuler",
    "Delete": "Supprimer",
    "Save": "Enregistrer",
    "Filter": "Filtrer",
    "All": "Tout",
    "Planned": "Planifié",
    "In-Progress": "En cours",
    "Quality Check": "Contrôle qualité",
    "Completed": "Terminé",
    "Passed": "Conforme",
    "Rejected": "Rejeté",
    "Passed with Variance": "Conforme avec dérogation",
    "Rework Required": "Retraitement requis",
    "Standard Input": "Entrée standard",
    "Actual Input": "Entrée réelle pesée",
    "Cleaning Loss": "Perte au nettoyage",
    "Invisible Loss": "Perte invisible (évaporation)",
    "Usable Output": "Sortie exploitable",
    "Total Yield": "Rendement global (%)",
    "Variance Evaluation": "Évaluation des écarts",
    "Only Company Admin has permission to delete BOM recipes.": "Seul l'administrateur de l'entreprise est autorisé à supprimer les recettes BOM.",
    "Only Company Admin has permission to delete production orders.": "Seul l'administrateur de l'entreprise est autorisé à supprimer les ordres de fabrication.",
    "Only Company Admin has permission to delete QC templates.": "Seul l'administrateur de l'entreprise est autorisé à supprimer les modèles CQ.",
    "Only Company Admin has permission to create new QC templates.": "Seul l'administrateur de l'entreprise est autorisé à créer de nouveaux modèles CQ.",
    "Auto-Calculated Invisible Loss (Moisture Evaporation)": "Perte invisible calculée automatiquement (évaporation)",
    "Actual Output Yield Weighed & Unit Cost Allocation": "Rendement réel pesé et allocation du coût unitaire",
    "Allocates the total batch cost across multiple finished products and bran.": "Répartit le coût global du lot entre les produits finis et le son.",
    "Avg Invisible Loss %": "Perte invisible moyenne %",
    "BOM Code": "Code BOM",
    "BOM Recipe": "Recette de fabrication (BOM)",
    "Base Batch Input (kg)": "Charge de base du lot (kg)",
    "Batch #": "N° de lot",
    "Batch Traveler": "Fiche suiveuse de lot"
}

EN_TO_ES = {
    "Production Orders & Batch Runs": "Órdenes de producción y lotes",
    "Production Runs & Batches": "Lotes y órdenes de producción",
    "Work Needed": "Trabajo requerido",
    "Work Available": "Trabajo disponible",
    "All Orders": "Todas las órdenes",
    "Batches Producible": "Lotes realizables",
    "Batches Available from Stock": "Lotes disponibles en stock",
    "Active In-Flight": "En proceso de fabricación",
    "Active Orders": "Órdenes activas",
    "Insufficient Raw Materials": "Materia prima insuficiente",
    "Low Raw Materials": "Bajo stock de materia prima",
    "Warehouse Parts Availability": "Disponibilidad de insumos en almacén",
    "In-Flight Batches": "Lotes en proceso de producción",
    "Delete Bill of Materials Recipe": "Eliminar receta de lista de materiales (BOM)",
    "Delete BOM Recipe": "Eliminar receta BOM",
    "Delete Production Batch Run": "Eliminar lote de producción",
    "Delete Production Order": "Eliminar orden de producción",
    "Delete Order": "Eliminar orden",
    "Delete Recipe": "Eliminar receta",
    "Delete QC Standard Template": "Eliminar plantilla de estándar de calidad",
    "Start Now (In-Progress)": "Iniciar ahora (En proceso)",
    "Schedule (Planned)": "Programar (Planificado)",
    "Production Execution Mode": "Modo de ejecución de producción",
    "Immediately deducts parts from warehouse stock": "Deduce inmediatamente los insumos del almacén",
    "Leaves parts in inventory until batch starts": "Mantiene los insumos en stock hasta el inicio del lote",
    "Parts to be Consumed from Warehouse": "Insumos a consumir del almacén",
    "Start Batch & Deduct Stock": "Iniciar lote y deducir stock",
    "Schedule Production Order": "Programar orden de producción",
    "QC Variance Alert: Proceed with Stocking?": "Alerta de variación de calidad: ¿Proceder con el almacenamiento?",
    "Proceed & Stock Anyway": "Proceder y almacenar de todos modos",
    "No production orders matching selected filter.": "No hay órdenes de producción que coincidan con el filtro.",
    "BOM Recipe Builder": "Diseñador de recetas BOM",
    "BOM recipe deleted": "Receta BOM eliminada con éxito",
    "Production Batch Started": "Lote de producción iniciado",
    "Production Batch Planned": "Lote de producción planificado",
    "Production Order Planned": "Orden de producción planificada",
    "Batch & Run #": "N° de lote y serie",
    "Target Warehouse": "Almacén destino",
    "Planned Input": "Insumo planificado",
    "Outputs (Yield)": "Rendimiento de salidas",
    "TBS QC Result": "Resultado de calidad TBS",
    "Start Batch": "Iniciar lote",
    "Live Runner": "Ejecución en vivo",
    "QC Lab Test": "Prueba de laboratorio de calidad",
    "Complete & Stock": "Finalizar y almacenar",
    "Production Order Audit Trail & Timeline": "Pista de auditoría e historial de producción",
    "Print Batch Traveler & TBS Slip": "Imprimir hoja de ruta del lote y comprobante TBS",
    "products stocked": "productos almacenados",
    "Joint Product & Multi-Output BOM Recipes": "Recetas BOM de productos conjuntos y subproductos",
    "Multi-output recipe builder supporting flour, semolina, bran, packaging, and automatic joint-cost allocation.": "Creador de recetas de múltiples salidas con asignación automática de costos conjuntos.",
    "Create New Multi-Output BOM": "Crear nueva receta BOM de múltiples salidas",
    "Base Batch Input": "Carga base del lote",
    "Total Estimated Cost": "Costo total estimado",
    "Raw Materials": "Materias primas",
    "ingredients": "ingredientes",
    "Outputs (Co-Products & By-Products)": "Salidas (Coproductos y subproductos)",
    "Edit Recipe": "Editar receta",
    "Delete Recipe": "Eliminar receta",
    "Plan Production Order / Batch": "Planificar orden de producción / lote",
    "Select BOM Recipe": "Seleccionar receta BOM",
    "Batch Number": "Número de lote",
    "Raw Input Weight (kg)": "Peso de materia prima (kg)",
    "Planned Date": "Fecha planificada",
    "Target Expiry Date": "Fecha de vencimiento prevista",
    "Target Production Warehouse / Depot": "Almacén de producción destino",
    "Operational Notes / Shift": "Notas operativas / Turno",
    "Confirm Production Order": "Confirmar orden de producción",
    "Cancel": "Cancelar",
    "Delete": "Eliminar",
    "Save": "Guardar",
    "Filter": "Filtrar",
    "All": "Todo",
    "Planned": "Planificado",
    "In-Progress": "En proceso",
    "Quality Check": "Control de calidad",
    "Completed": "Completado",
    "Passed": "Aprobado",
    "Rejected": "Rechazado",
    "Passed with Variance": "Aprobado con variación",
    "Rework Required": "Reproceso requerido",
    "Standard Input": "Insumo estándar",
    "Actual Input": "Insumo real pesado",
    "Cleaning Loss": "Pérdida por limpieza",
    "Invisible Loss": "Pérdida invisible (evaporación)",
    "Usable Output": "Salida utilizable",
    "Total Yield": "Rendimiento total (%)",
    "Variance Evaluation": "Evaluación de variaciones",
    "Only Company Admin has permission to delete BOM recipes.": "Solo el administrador de la empresa puede eliminar recetas BOM.",
    "Only Company Admin has permission to delete production orders.": "Solo el administrador de la empresa puede eliminar órdenes de producción.",
    "Only Company Admin has permission to delete QC templates.": "Solo el administrador de la empresa puede eliminar plantillas de calidad.",
    "Only Company Admin has permission to create new QC templates.": "Solo el administrador de la empresa puede crear plantillas de calidad.",
    "Auto-Calculated Invisible Loss (Moisture Evaporation)": "Pérdida invisible calculada automáticamente (evaporación)",
    "Actual Output Yield Weighed & Unit Cost Allocation": "Rendimiento real pesado y asignación de costo unitario",
    "Allocates the total batch cost across multiple finished products and bran.": "Distribuye el costo total del lote entre los productos finales y el salvado.",
    "Avg Invisible Loss %": "Pérdida invisible promedio %",
    "BOM Code": "Código BOM",
    "BOM Recipe": "Receta de lista de materiales (BOM)",
    "Base Batch Input (kg)": "Insumo base del lote (kg)",
    "Batch #": "N° de lote",
    "Batch Traveler": "Hoja de ruta del lote"
}

def translate_to_en(sw_text):
    if sw_text in GLOSSARY and "en" in GLOSSARY[sw_text]:
        return GLOSSARY[sw_text]["en"]
    # Check if already english
    if not re.search(r'[^\x00-\x7F]', sw_text) and not re.search(r'\b(bidhaa|bei|mteja|duka|ripoti|malipo|anza|funga|fungua|weka|kamilisha|namba)\b', sw_text, re.I):
        return sw_text
    
    # Common Swahili phrases
    t = sw_text
    replacements = [
        ("Agizo", "Order"),
        ("agizo", "order"),
        ("Maagizo", "Orders"),
        ("maagizo", "orders"),
        ("Bidhaa", "Product"),
        ("bidhaa", "product"),
        ("Mteja", "Customer"),
        ("mteja", "customer"),
        ("Wateja", "Customers"),
        ("wateja", "customers"),
        ("Muuzaji", "Seller"),
        ("muuzaji", "seller"),
        ("Wauzaji", "Sellers"),
        ("wauzaji", "sellers"),
        ("Malipo", "Payment"),
        ("malipo", "payment"),
        ("Duka", "Store"),
        ("duka", "store"),
        ("Maduka", "Stores"),
        ("maduka", "stores"),
        ("Ghala", "Warehouse"),
        ("ghala", "warehouse"),
        ("Bei", "Price"),
        ("bei", "price"),
        ("Pesa", "Money"),
        ("pesa", "money"),
        ("Kiasi", "Amount"),
        ("kiasi", "amount"),
        ("Jumla", "Total"),
        ("jumla", "total"),
        ("Salio", "Balance"),
        ("salio", "balance"),
        ("Ripoti", "Report"),
        ("ripoti", "report"),
        ("Ankara", "Invoice"),
        ("ankara", "invoice"),
        ("Risiti", "Receipt"),
        ("risiti", "receipt"),
        ("Ujumbe", "Message"),
        ("ujumbe", "message"),
        ("Arifa", "Notification"),
        ("arifa", "notification"),
        ("Kikundi", "Group"),
        ("kikundi", "group"),
        ("Hakuna", "No"),
        ("hakuna", "no"),
        ("Imekamilika", "Completed"),
        ("imekamilika", "completed"),
        ("Imefanikiwa", "Successful"),
        ("imefanikiwa", "successful"),
        ("Imeshindwa", "Failed"),
        ("imeshindwa", "failed"),
        ("Ghairi", "Cancel"),
        ("ghairi", "cancel"),
        ("Hifadhi", "Save"),
        ("hifadhi", "save"),
        ("Futa", "Delete"),
        ("futa", "delete"),
        ("Hariri", "Edit"),
        ("hariri", "edit"),
        ("Thibitisha", "Confirm"),
        ("thibitisha", "confirm"),
        ("Tuma", "Send"),
        ("tuma", "send"),
        ("Pakia", "Upload"),
        ("pakia", "upload"),
        ("Pakua", "Download"),
        ("pakua", "download"),
        ("Tafuta", "Search"),
        ("tafuta", "search"),
        ("Chuja", "Filter"),
        ("chuja", "filter"),
        ("Angalia", "View"),
        ("angalia", "view"),
        ("Onyesha", "Show"),
        ("onyesha", "show"),
        ("Ficha", "Hide"),
        ("ficha", "hide"),
        ("Badilisha", "Change"),
        ("badilisha", "change"),
        ("Weka", "Add"),
        ("weka", "add"),
        ("Ondoa", "Remove"),
        ("ondoa", "remove"),
        ("Anza", "Start"),
        ("anza", "start"),
        ("Mwisho", "End"),
        ("mwisho", "end"),
        ("Leo", "Today"),
        ("leo", "today"),
        ("Jana", "Yesterday"),
        ("jana", "yesterday"),
        ("Kesho", "Tomorrow"),
        ("kesho", "tomorrow"),
        ("Wiki hii", "This week"),
        ("Mwezi huu", "This month"),
        ("Mwaka huu", "This year")
    ]
    for sw_w, en_w in replacements:
        t = re.sub(r'\b' + re.escape(sw_w) + r'\b', en_w, t)
    return t

def translate_to_sw(en_text):
    if en_text in EN_TO_SW:
        return EN_TO_SW[en_text]
    if en_text in GLOSSARY and "sw" in GLOSSARY[en_text]:
        return GLOSSARY[en_text]["sw"]
    
    # Common procedural replacements
    t = en_text
    replacements = [
        ("Access Denied: Only Super Admins can delete a company.", "Upatikanaji Umekataliwa: Super Admin pekee ndiye anayeweza kufuta kampuni."),
        ("Access Denied: Branch Administrators cannot create or edit branches.", "Upatikanaji Umekataliwa: Wasimamizi wa Tawi hawawezi kuunda au kuhariri matawi."),
        ("Access Denied: Branch Administrators cannot delete branches.", "Upatikanaji Umekataliwa: Wasimamizi wa Tawi hawawezi kufuta matawi."),
        ("Access Denied: You cannot delete branches belonging to another company.", "Upatikanaji Umekataliwa: Huwezi kufuta matawi ya kampuni nyingine."),
        ("Access Denied: You cannot delete stores belonging to another company.", "Upatikanaji Umekataliwa: Huwezi kufuta maduka ya kampuni nyingine."),
        ("Access Denied: You cannot edit branches of another company.", "Upatikanaji Umekataliwa: Huwezi kuhariri matawi ya kampuni nyingine."),
        ("Access Denied: You cannot edit stores of another company.", "Upatikanaji Umekataliwa: Huwezi kuhariri maduka ya kampuni nyingine."),
        ("Access restricted: Branch Administrators cannot add payment methods without Admin approval.", "Upatikanaji umezuiwa: Wasimamizi wa Tawi hawawezi kuongeza njia za malipo bila idhini ya Admin."),
        ("Access restricted: Branch Administrators cannot add stores without Admin approval.", "Upatikanaji umezuiwa: Wasimamizi wa Tawi hawawezi kuongeza maduka bila idhini ya Admin."),
        ("Access restricted: Branch Administrators cannot delete stores without Admin approval.", "Upatikanaji umezuiwa: Wasimamizi wa Tawi hawawezi kufuta maduka bila idhini ya Admin."),
        ("Access restricted: Branch Administrators cannot edit stores without Admin approval.", "Upatikanaji umezuiwa: Wasimamizi wa Tawi hawawezi kuhariri maduka bila idhini ya Admin."),
        ("Access restricted: Branch Administrators cannot modify Store Profile without Admin approval.", "Upatikanaji umezuiwa: Wasimamizi wa Tawi hawawezi kubadilisha Wasifu wa Duka bila idhini ya Admin."),
        ("Access restricted: Branch Administrators cannot modify payment methods without Admin approval.", "Upatikanaji umezuiwa: Wasimamizi wa Tawi hawawezi kubadilisha njia za malipo bila idhini ya Admin."),
        ("Access restricted: Branch Administrators cannot modify store live status without Admin approval.", "Upatikanaji umezuiwa: Wasimamizi wa Tawi hawawezi kubadilisha hali ya duka moja kwa moja bila idhini ya Admin."),
        ("Account not found. Please check your username and try again.", "Akaunti haikupatikana. Tafadhali kagua jina la mtumiaji na ujaribu tena."),
        ("A network or server error occurred during sync", "Hitilafu ya mtandao au seva ilitokea wakati wa usawazishaji"),
        ("A new version is available.", "Toleo jipya linapatikana.")
    ]
    for en_w, sw_w in replacements:
        if en_text == en_w:
            return sw_w
        t = t.replace(en_w, sw_w)
    return t

def translate_to_fr(text):
    if text in EN_TO_FR:
        return EN_TO_FR[text]
    if text in GLOSSARY and "fr" in GLOSSARY[text]:
        return GLOSSARY[text]["fr"]
    # Procedural
    t = text
    patterns = [
        (r'\bAccess Denied\b', "Accès refusé"),
        (r'\bAccess restricted\b', "Accès restreint"),
        (r'\bBranch Administrators\b', "Administrateurs de succursale"),
        (r'\bCompany Administrator\b', "Administrateur de l'entreprise"),
        (r'\bSuper Admin\b', "Super Administrateur"),
        (r'\bcannot delete\b', "ne peuvent pas supprimer"),
        (r'\bcannot create\b', "ne peuvent pas créer"),
        (r'\bcannot edit\b', "ne peuvent pas modifier"),
        (r'\bwithout Admin approval\b', "sans l'approbation de l'administrateur"),
        (r'\bAccount not found\b', "Compte introuvable"),
        (r'\bPlease check your username and try again\b', "Veuillez vérifier votre nom d'utilisateur et réessayer"),
        (r'\bA network or server error occurred during sync\b', "Une erreur réseau ou serveur est survenue lors de la synchronisation"),
        (r'\bA new version is available\b', "Une nouvelle version est disponible"),
        (r'\bProduction\b', "Production"),
        (r'\bBatch\b', "Lot"),
        (r'\bOrder\b', "Commande"),
        (r'\bOrders\b', "Commandes"),
        (r'\bCustomer\b', "Client"),
        (r'\bCustomers\b', "Clients"),
        (r'\bSeller\b', "Vendeur"),
        (r'\bSellers\b', "Vendeurs"),
        (r'\bInvoice\b', "Facture"),
        (r'\bReceipt\b', "Reçu"),
        (r'\bPayment\b', "Paiement"),
        (r'\bReport\b', "Rapport"),
        (r'\bWarehouse\b', "Entrepôt"),
        (r'\bStore\b', "Magasin"),
        (r'\bDelete\b', "Supprimer"),
        (r'\bEdit\b', "Modifier"),
        (r'\bSave\b', "Enregistrer"),
        (r'\bCancel\b', "Annuler"),
        (r'\bConfirm\b', "Confirmer"),
        (r'\bDownload\b', "Télécharger"),
        (r'\bUpload\b', "Téléverser"),
        (r'\bClose\b', "Fermer"),
        (r'\bView\b', "Voir")
    ]
    for pat, rep in patterns:
        t = re.sub(pat, rep, t)
    return t

def translate_to_es(text):
    if text in EN_TO_ES:
        return EN_TO_ES[text]
    if text in GLOSSARY and "es" in GLOSSARY[text]:
        return GLOSSARY[text]["es"]
    # Procedural
    t = text
    patterns = [
        (r'\bAccess Denied\b', "Acceso denegado"),
        (r'\bAccess restricted\b', "Acceso restringido"),
        (r'\bBranch Administrators\b', "Administradores de sucursal"),
        (r'\bCompany Administrator\b', "Administrador de la empresa"),
        (r'\bSuper Admin\b', "Super Administrador"),
        (r'\bcannot delete\b', "no pueden eliminar"),
        (r'\bcannot create\b', "no pueden crear"),
        (r'\bcannot edit\b', "no pueden editar"),
        (r'\bwithout Admin approval\b', "sin la aprobación del administrador"),
        (r'\bAccount not found\b', "Cuenta no encontrada"),
        (r'\bPlease check your username and try again\b', "Verifique su nombre de usuario e intente nuevamente"),
        (r'\bA network or server error occurred during sync\b', "Ocurrió un error de red o servidor durante la sincronización"),
        (r'\bA new version is available\b', "Una nueva versión está disponible"),
        (r'\bProduction\b', "Producción"),
        (r'\bBatch\b', "Lote"),
        (r'\bOrder\b', "Orden"),
        (r'\bOrders\b', "Órdenes"),
        (r'\bCustomer\b', "Cliente"),
        (r'\bCustomers\b', "Clientes"),
        (r'\bSeller\b', "Vendedor"),
        (r'\bSellers\b', "Vendedores"),
        (r'\bInvoice\b', "Factura"),
        (r'\bReceipt\b', "Recibo"),
        (r'\bPayment\b', "Pago"),
        (r'\bReport\b', "Informe"),
        (r'\bWarehouse\b', "Almacén"),
        (r'\bStore\b', "Tienda"),
        (r'\bDelete\b', "Eliminar"),
        (r'\bEdit\b', "Editar"),
        (r'\bSave\b', "Guardar"),
        (r'\bCancel\b', "Cancelar"),
        (r'\bConfirm\b', "Confirmar"),
        (r'\bDownload\b', "Descargar"),
        (r'\bUpload\b', "Subir"),
        (r'\bClose\b', "Cerrar"),
        (r'\bView\b', "Ver")
    ]
    for pat, rep in patterns:
        t = re.sub(pat, rep, t)
    return t

# Build new dictionary blocks
new_en_dict = {}
for k in en_swahili_keys:
    val = translate_to_en(k)
    if val:
        new_en_dict[k] = val

new_sw_dict = {}
for k in sw_english_keys:
    val = translate_to_sw(k)
    if val:
        new_sw_dict[k] = val

new_fr_dict = {}
for k in fr_keys:
    val = translate_to_fr(k)
    if val:
        new_fr_dict[k] = val

new_es_dict = {}
for k in es_keys:
    val = translate_to_es(k)
    if val:
        new_es_dict[k] = val

print(f"Generated new translations: EN: {len(new_en_dict)}, SW: {len(new_sw_dict)}, FR: {len(new_fr_dict)}, ES: {len(new_es_dict)}")

# Now read src/utils/format.ts and append new entries to the respective dictionaries
format_ts_path = 'src/utils/format.ts'
with open(format_ts_path, 'r', encoding='utf-8') as f:
    content = f.read()

def escape_str(s):
    return s.replace('\\', '\\\\').replace("'", "\\'")

def format_entries(d, comment):
    lines = [f"\n  // --- {comment} ---"]
    for k, v in sorted(d.items()):
        lines.append(f"  '{escape_str(k)}': '{escape_str(v)}',")
    return "\n".join(lines) + "\n"

# 1. Append to swahiliDict
sw_pos = content.find('\nexport const frenchDict')
if sw_pos != -1:
    # Find closing '};' before frenchDict
    last_brace = content.rfind('};', 0, sw_pos)
    if last_brace != -1:
        addition = format_entries(new_sw_dict, "BATCH SYNC: Comprehensive Swahili ERP Translations")
        content = content[:last_brace] + addition + content[last_brace:]
        print("Injected into swahiliDict")

# 2. Append to frenchDict
fr_pos = content.find('\nexport const spanishDict')
if fr_pos != -1:
    last_brace = content.rfind('};', 0, fr_pos)
    if last_brace != -1:
        addition = format_entries(new_fr_dict, "BATCH SYNC: Comprehensive French ERP Translations")
        content = content[:last_brace] + addition + content[last_brace:]
        print("Injected into frenchDict")

# 3. Append to spanishDict
es_pos = content.find('\nexport const englishDict')
if es_pos != -1:
    last_brace = content.rfind('};', 0, es_pos)
    if last_brace != -1:
        addition = format_entries(new_es_dict, "BATCH SYNC: Comprehensive Spanish ERP Translations")
        content = content[:last_brace] + addition + content[last_brace:]
        print("Injected into spanishDict")

# 4. Append to englishDict
en_pos = content.find('\nexport function translate')
if en_pos != -1:
    last_brace = content.rfind('};', 0, en_pos)
    if last_brace != -1:
        addition = format_entries(new_en_dict, "BATCH SYNC: Comprehensive English ERP Translations")
        content = content[:last_brace] + addition + content[last_brace:]
        print("Injected into englishDict")

with open(format_ts_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully written updated src/utils/format.ts")
