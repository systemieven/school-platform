// Form validation and handling
document.addEventListener('DOMContentLoaded', () => {
  initializeFormValidation();
  initializeFileHandling();
  updateNavigationButtons();
  initializeInputMasks();
  initializeAddressCopy();
});

let currentTab = 0;
const tabs = ['responsavel', 'aluno', 'documentacao'];

// Initialize form validation
function initializeFormValidation() {
  const form = document.getElementById('enrollmentForm');
  if (!form) return;

  // Add validation to all required fields
  form.querySelectorAll('input[required], select[required]').forEach(field => {
    field.addEventListener('input', () => validateField(field));
    field.addEventListener('blur', () => validateField(field));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!validateCurrentTab()) {
      Swal.fire({
        title: 'Atenção!',
        text: 'Por favor, preencha todos os campos obrigatórios corretamente.',
        icon: 'warning',
        confirmButtonColor: '#003876'
      });
      return;
    }

    try {
      const formData = new FormData(form);
      
      // Add files to FormData
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput && fileInput.files.length > 0) {
        Array.from(fileInput.files).forEach((file, index) => {
          formData.append(`documento_${index + 1}`, file);
        });
      }

      // Show loading state
      Swal.fire({
        title: 'Enviando...',
        text: 'Por favor, aguarde enquanto processamos sua inscrição.',
        allowOutsideClick: false,
        showConfirmButton: false,
        willOpen: () => {
          Swal.showLoading();
        }
      });

      // Send form data
      const response = await fetch('https://webhook.ibotcloud.com.br/webhook/recebe-matricula', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Erro ao enviar formulário');
      }

      // Show success message
      Swal.fire({
        title: 'Sucesso!',
        text: 'Sua pré-matrícula foi enviada com sucesso! Em breve entraremos em contato.',
        icon: 'success',
        confirmButtonColor: '#003876'
      }).then(() => {
        form.reset();
        window.location.href = '/';
      });
    } catch (error) {
      Swal.fire({
        title: 'Erro!',
        text: 'Ocorreu um erro ao enviar o formulário. Por favor, tente novamente.',
        icon: 'error',
        confirmButtonColor: '#003876'
      });
    }
  });
}

// Initialize input masks
function initializeInputMasks() {
  const masks = {
    cpf: value => {
      return value
        .replace(/\D/g, '')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
        .substring(0, 14);
    },
    phone: value => {
      return value
        .replace(/\D/g, '')
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .substring(0, 15);
    },
    cep: value => {
      return value
        .replace(/\D/g, '')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .substring(0, 9);
    }
  };

  document.querySelectorAll('input').forEach(input => {
    const name = input.getAttribute('name');
    if (name?.includes('cpf')) {
      input.addEventListener('input', e => {
        e.target.value = masks.cpf(e.target.value);
      });
    } else if (name?.includes('celular')) {
      input.addEventListener('input', e => {
        e.target.value = masks.phone(e.target.value);
      });
    } else if (name?.includes('cep')) {
      input.addEventListener('input', e => {
        e.target.value = masks.cep(e.target.value);
      });
    }
  });
}

// Initialize file handling
function initializeFileHandling() {
  const fileInput = document.querySelector('input[type="file"]');
  const fileList = document.getElementById('fileList');
  const fileListUl = fileList?.querySelector('ul');

  if (fileInput && fileList && fileListUl) {
    fileInput.addEventListener('change', () => {
      fileListUl.innerHTML = '';
      let hasInvalidFile = false;

      Array.from(fileInput.files).forEach(file => {
        if (file.size > 5 * 1024 * 1024) {
          hasInvalidFile = true;
          Swal.fire({
            title: 'Arquivo muito grande',
            text: `O arquivo "${file.name}" excede o limite de 5MB`,
            icon: 'error',
            confirmButtonColor: '#003876'
          });
          return;
        }
        
        const li = document.createElement('li');
        li.className = 'flex items-center text-sm text-gray-600';
        li.innerHTML = `
          <i data-lucide="file-text" class="w-4 h-4 mr-2"></i>
          <span>${file.name}</span>
        `;
        fileListUl.appendChild(li);
      });

      if (fileInput.files.length > 0 && !hasInvalidFile) {
        fileList.classList.remove('hidden');
        lucide.createIcons();
      } else {
        fileList.classList.add('hidden');
      }
    });
  }
}

// Initialize address copy functionality
function initializeAddressCopy() {
  const checkbox = document.getElementById('sameAddress');
  if (checkbox) {
    checkbox.addEventListener('change', (e) => {
      copyAddress(e.target.checked);
    });
  }
}

// Switch tabs
window.switchTab = function(index) {
  if (index === currentTab) return;
  
  if (index > currentTab && !validateCurrentTab()) {
    Swal.fire({
      title: 'Atenção!',
      text: 'Por favor, preencha todos os campos obrigatórios desta seção antes de continuar.',
      icon: 'warning',
      confirmButtonColor: '#003876'
    });
    return;
  }

  document.querySelectorAll('[role="tab"]').forEach((tab, i) => {
    tab.setAttribute('aria-selected', i === index ? 'true' : 'false');
    tab.classList.toggle('text-[#003876]', i === index);
    tab.classList.toggle('text-gray-500', i !== index);
    const divElement = tab.querySelector('div');
    if (divElement) {
      divElement.classList.toggle('bg-[#003876]', i === index);
      divElement.classList.toggle('bg-gray-200', i !== index);
    }
  });

  document.querySelectorAll('[role="tabpanel"]').forEach((panel, i) => {
    panel.classList.toggle('hidden', i !== index);
  });

  currentTab = index;
  updateNavigationButtons();
};

// Navigate between tabs
window.nextTab = function() {
  if (currentTab < tabs.length - 1) {
    switchTab(currentTab + 1);
  }
};

window.previousTab = function() {
  if (currentTab > 0) {
    switchTab(currentTab - 1);
  }
};

// Update navigation buttons
function updateNavigationButtons() {
  const prevButton = document.getElementById('prevButton');
  const nextButton = document.getElementById('nextButton');
  const submitButton = document.getElementById('submitButton');

  if (prevButton) {
    prevButton.style.display = currentTab === 0 ? 'none' : 'block';
  }

  if (nextButton && submitButton) {
    if (currentTab === tabs.length - 1) {
      nextButton.style.display = 'none';
      submitButton.style.display = 'flex';
    } else {
      nextButton.style.display = 'block';
      submitButton.style.display = 'none';
    }
  }
}

// Validate current tab
function validateCurrentTab() {
  const currentPanel = document.getElementById(`tab-${tabs[currentTab]}`);
  if (!currentPanel) return true;

  const requiredFields = currentPanel.querySelectorAll('[required]');
  let isValid = true;

  requiredFields.forEach(field => {
    if (!validateField(field)) {
      isValid = false;
    }
  });

  return isValid;
}

// Validate individual field
function validateField(field) {
  const errorMessage = field.parentElement.querySelector('.error-message');
  let isValid = true;

  // Clear previous error state
  field.classList.remove('border-red-500');
  if (errorMessage) {
    errorMessage.classList.add('hidden');
  }

  // Required field validation
  if (field.hasAttribute('required') && !field.value.trim()) {
    isValid = false;
  }

  // Pattern validation
  if (field.pattern && field.value.trim()) {
    const regex = new RegExp(field.pattern);
    if (!regex.test(field.value)) {
      isValid = false;
    }
  }

  // Email validation
  if (field.type === 'email' && field.value.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(field.value)) {
      isValid = false;
    }
  }

  // Show error state if invalid
  if (!isValid) {
    field.classList.add('border-red-500');
    if (errorMessage) {
      errorMessage.classList.remove('hidden');
    }
  }

  return isValid;
}

// Copy address fields
function copyAddress(checked) {
  const fields = ['cep', 'rua', 'numero', 'complemento', 'bairro', 'cidade', 'uf'];
  
  fields.forEach(field => {
    const source = document.querySelector(`[name="${field}Responsavel"]`);
    const target = document.querySelector(`[name="${field}Aluno"]`);
    
    if (source && target) {
      if (checked) {
        target.value = source.value;
        target.disabled = true;
        validateField(target);
      } else {
        target.value = '';
        target.disabled = false;
        validateField(target);
      }
    }
  });
}

window.copyAddress = copyAddress;