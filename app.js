
const $ = (selector) => document.querySelector(selector);

const ids = [
  '#inicio',
  '#boas',
  '#agendar',
  '#servicos',
  '#pagamento',
  '#thanks'
];

let client = {};
let selected = new Set();
let services = [];
let supabaseClient = null;
let servicesLoaded = false;

function on(selector, event, handler) {
  const element = $(selector);
  if (element) element.addEventListener(event, handler);
}

function br(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function show(id) {
  ids.forEach((selector) => {
    $(selector)?.classList.add('hidden');
  });

  $(id)?.classList.remove('hidden');

  if (id === '#servicos') render();
  if (id === '#pagamento') totals();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function sum() {
  return services
    .filter((service) => selected.has(String(service.id)))
    .reduce((total, service) => total + Number(service.price || 0), 0);
}

function totals() {
  const total = br(sum());

  if ($('#total1')) $('#total1').textContent = total;
  if ($('#total2')) $('#total2').textContent = total;
}

function setNotice(message) {
  const notice = $('#servicesNotice');
  if (notice) notice.textContent = message;
}

function render() {
  const list = $('#serviceList');
  if (!list) return;

  list.innerHTML = '';

  if (!servicesLoaded) {
    list.textContent = 'Carregando serviços...';
    totals();
    return;
  }

  if (!services.length) {
    list.textContent = 'Não há serviços para exibir. Verifique o Console do navegador.';
    totals();
    return;
  }

  services.forEach((service) => {
    const row = document.createElement('div');
    row.className = 'service';

    const label = document.createElement('label');
    const checkbox = document.createElement('input');

    checkbox.type = 'checkbox';
    checkbox.checked = selected.has(String(service.id));

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selected.add(String(service.id));
      } else {
        selected.delete(String(service.id));
      }

      totals();
    });

    const name = document.createElement('span');
    name.textContent = service.name;

    const price = document.createElement('span');
    price.className = 'price';
    price.textContent = br(service.price);

    label.append(checkbox, name);
    row.append(label, price);
    list.append(row);
  });

  totals();
}

function setupSupabase() {
  const config = window.VENTURA_CONFIG;

  if (
    !window.supabase ||
    !config ||
    !config.supabaseUrl ||
    !config.supabasePublishableKey
  ) {
    console.error(
      'Supabase não inicializado. Verifique config.js e a biblioteca Supabase no index.html.'
    );
    return false;
  }

  try {
    supabaseClient = window.supabase.createClient(
      config.supabaseUrl,
      config.supabasePublishableKey
    );

    return true;
  } catch (error) {
    console.error('Erro ao iniciar Supabase:', error);
    return false;
  }
}

async function loadServices() {
  servicesLoaded = false;
  services = [];
  render();
  setNotice('Carregando serviços...');

  if (!supabaseClient) {
    servicesLoaded = true;
    setNotice('Não foi possível conectar ao banco. Verifique a configuração.');
    render();
    return;
  }

  try {
    // Consulta sem filtro de active, apenas para diagnóstico.
    const { data, error } = await supabaseClient
      .from('services')
      .select('id, name, price, active')
      .order('id', { ascending: true });

    console.log('Serviços recebidos do Supabase:', data);
    console.log('Erro do Supabase:', error);

    if (error) throw error;

    // Exibe somente serviços ativos, sem usar dados de exemplo.
    services = (data || [])
      .filter((service) => service.active === true)
      .map((service) => ({
        id: String(service.id),
        name: String(service.name),
        price: Number(service.price)
      }));

    const activeIds = new Set(services.map((service) => service.id));

    selected = new Set(
      [...selected].filter((id) => activeIds.has(String(id)))
    );

    servicesLoaded = true;

    setNotice(
      services.length
        ? ''
        : 'Nenhum serviço ativo foi encontrado. Confira os dados recebidos no Console.'
    );

    render();
  } catch (error) {
    console.error('Erro ao carregar serviços:', error);

    services = [];
    selected.clear();
    servicesLoaded = true;

    setNotice(
      'Não foi possível carregar os serviços. Verifique o Console do navegador.'
    );

    render();
  }
}

function formatPreferredTime() {
  return `${client.date || ''} às ${client.time || ''}`;
}

on('#start', 'click', () => show('#boas'));

on('#continue', 'click', () => show('#agendar'));

on('#clientForm', 'submit', (event) => {
  event.preventDefault();

  const form = new FormData(event.currentTarget);

  client = {
    name: String(form.get('name') || '').trim(),
    phone: String(form.get('phone') || '').trim(),
    date: String(form.get('date') || ''),
    time: String(form.get('time') || '')
  };

  show('#servicos');
});

on('#backClient', 'click', () => show('#agendar'));

on('#toPay', 'click', () => {
  if (!servicesLoaded) {
    alert('Aguarde o carregamento dos serviços.');
    return;
  }

  if (!selected.size) {
    alert('Escolha pelo menos um serviço.');
    return;
  }

  show('#pagamento');
});

on('#backServices', 'click', () => show('#servicos'));

on('#submit', 'click', async () => {
  const payment = document.querySelector(
    'input[name="payment"]:checked'
  );

  if (!payment) {
    alert('Escolha a forma de pagamento.');
    return;
  }

  if (!$('#agree')?.checked) {
    alert('Confirme os dados antes de continuar.');
    return;
  }

  const chosen = services.filter((service) =>
    selected.has(String(service.id))
  );

  if (!chosen.length) {
    alert('Escolha pelo menos um serviço.');
    return;
  }

  client.payment = payment.value;

  const total = sum();

  const message = `Olá! Gostaria de solicitar um agendamento na Ventura — Em Gel.
Nome: ${client.name}
Telefone: ${client.phone}
Preferência: ${formatPreferredTime()}
Serviços:
${chosen.map((service) =>
  `• ${service.name} — ${br(service.price)}`
).join('\n')}
Total estimado: ${br(total)}
Pagamento: ${client.payment}
Por favor, confirme a disponibilidade.`;

  const whatsapp = $('#wa');

  if (whatsapp) {
    whatsapp.href =
      'https://wa.me/5566992923000?text=' +
      encodeURIComponent(message);
  }

  const status = $('#status');
  const button = $('#submit');

  if (button) button.disabled = true;
  if (status) status.textContent = 'Registrando sua solicitação...';

  try {
    if (!supabaseClient) {
      throw new Error('Supabase não está conectado.');
    }

    const notes = [
      `Data desejada: ${client.date}`,
      `Horário desejado: ${client.time}`,
      `Serviços: ${chosen.map((service) =>
        `${service.name} (${br(service.price)})`
      ).join(', ')}`,
      `Total estimado: ${br(total)}`,
      `Forma de pagamento: ${client.payment}`
    ].join('\n');

    const { error } = await supabaseClient
      .from('bookings')
      .insert({
        customer_name: client.name,
        customer_phone: client.phone,
        preferred_time: formatPreferredTime(),
        notes
      });

    if (error) throw error;

    if (status) {
      status.textContent =
        'Solicitação registrada! Envie também a mensagem pelo WhatsApp para confirmar o horário.';
    }
  } catch (error) {
    console.error('Erro ao salvar agendamento:', error);

    if (status) {
      status.textContent =
        'Não foi possível registrar automaticamente. Envie a solicitação pelo WhatsApp.';
    }
  } finally {
    if (button) button.disabled = false;
  }

  show('#thanks');
});

on('#again', 'click', () => {
  client = {};
  selected.clear();

  $('#clientForm')?.reset();

  document.querySelectorAll('input[name="payment"]').forEach((input) => {
    input.checked = false;
  });

  if ($('#agree')) $('#agree').checked = false;

  show('#inicio');
});

setupSupabase();
loadServices();
