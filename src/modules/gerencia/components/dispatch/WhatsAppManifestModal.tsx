import React, { useState } from 'react';
import {
  MessageSquare,
  Copy,
  Check,
  ExternalLink,
  Truck,
  MapPin,
  Clock,
  Building2,
  Phone,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SalesOrder } from '@/types/comercial';
import { formatDateDisplay } from '../../pages/GestionComercialPage';

interface WhatsAppManifestModalProps {
  order: SalesOrder | null;
  isOpen: boolean;
  onClose: () => void;
}

export const generateWhatsAppManifestText = (order: SalesOrder): string => {
  const birds = order.allocated_quantity || order.requested_quantity || 0;
  const cages = order.estimated_cages || Math.ceil(birds / 8);
  const avgW = (order.min_weight_kg + order.max_weight_kg) / 2.0;
  const tons = order.estimated_total_kg
    ? (order.estimated_total_kg / 1000).toFixed(1)
    : ((birds * avgW) / 1000).toFixed(1);

  const slot = order.loading_slot_time || '03:00 - 05:00 hrs';
  const farmPhone = order.farm_contact_phone || '+51 987 654 321 (Balanza Granja)';
  const deliveryAddress =
    order.delivery_address || `Dirección registrada en Zona ${order.zone_code}`;

  return `🚛 *AVÍCOLA GR - HOJA DE RUTA Y MANIFIESTO DE TRANSPORTE*
━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *Orden de Saca:* ${order.order_number}
🗓 *Fecha de Saca:* ${formatDateDisplay(order.target_delivery_date)}
⏰ *Ventana Horaria en Balanza:* ${slot} (Turno ${order.transport_shift || 'Madrugada'})

📍 *ORIGEN (Punto de Carga):*
• Granja: ${order.assigned_farm_code || 'TRAD1'} (Galpón ${order.assigned_barn_code || 'G-01'})
• Teléfono Encargado Granja: ${farmPhone}

🏢 *DESTINO (Cliente Recepctor):*
• Cliente: ${order.client_name}
• RUC: ${order.client_tax_id || 'Sin RUC'}
• Zona: Zona ${order.zone_code} ${order.external_reference ? `| OC: ${order.external_reference}` : ''}
• Dirección de Entrega: ${deliveryAddress}

📦 *CARGA ASIGNADA:*
• Aves Vivas: ${birds.toLocaleString()} aves
• Volumen Estimado: ~${cages.toLocaleString()} jaulas
• Peso Total Estimado: ${tons} Ton (${order.min_weight_kg.toFixed(2)} - ${order.max_weight_kg.toFixed(2)} kg)
• Sexo Solicitado: ${order.sex_preference || 'Indistinto'}

🚚 *DATOS DE LA UNIDAD:*
• Vehículo: Placa ${order.transport_plate} (${order.transport_model || 'Camión de Distribución'})
• Conductor Titular: ${order.transport_driver_name}
• Cuadrilla Oficial de Atrape: ${order.transport_crew || 'Cuadrilla Oficial'}
━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ *Instrucciones Operativas:*
1. Presentarse en balanza de granja 15 minutos antes de la ventana horaria.
2. Verificar tarado de jaulas vacías antes de iniciar el entablado de aves.
3. Desplazamiento obligatorio con guía de remisión física y precintos de seguridad.`;
};

export const WhatsAppManifestModal: React.FC<WhatsAppManifestModalProps> = ({
  order,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  if (!order) return null;

  const manifestText = generateWhatsAppManifestText(order);

  // Limpiar teléfono del chofer para link directo wa.me
  const rawPhone = order.transport_driver_phone || '';
  const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
  const destinationPhone = cleanPhone.startsWith('51') ? cleanPhone : `51${cleanPhone}`;

  const handleOpenWhatsApp = () => {
    const encoded = encodeURIComponent(manifestText);
    const url = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${destinationPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(manifestText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback manual
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Hoja de Ruta y Manifiesto Móvil para el Chofer"
      size="lg"
    >
      <div className="space-y-4 text-xs">
        {/* Banner Informativo */}
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-black text-emerald-950 dark:text-emerald-100 text-sm">
                Envío Inmediato de Hoja de Ruta al Conductor
              </h4>
              <p className="text-emerald-800 dark:text-emerald-300 text-[11px]">
                Transmisión directa por WhatsApp con la orden de ruta, galpón de carga, jaulas y dirección del cliente.
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Conductor</span>
            <span className="font-mono font-black text-slate-900 dark:text-white text-xs">
              {order.transport_driver_name}
            </span>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-bold">
              {order.transport_driver_phone || 'Sin teléfono guardado'}
            </span>
          </div>
        </div>

        {/* Vista Previa del Mensaje Preformateado */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Vista Previa del Mensaje para WhatsApp Web
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-600 flex items-center gap-1 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600">¡Copiado al Portapapeles!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Mensaje</span>
                </>
              )}
            </button>
          </div>

          <pre className="p-4 bg-slate-950 text-emerald-400 font-mono text-[11px] rounded-2xl overflow-x-auto whitespace-pre-wrap max-h-72 border border-slate-800 shadow-inner leading-relaxed">
            {manifestText}
          </pre>
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Cerrar
          </Button>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs font-bold"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? 'Copiado' : 'Copiar Texto'}</span>
            </Button>

            <Button
              size="sm"
              onClick={handleOpenWhatsApp}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-1.5 shadow-sm px-4"
            >
              <MessageSquare className="w-4 h-4 fill-white" />
              <span>Enviar Manifiesto por WhatsApp</span>
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

