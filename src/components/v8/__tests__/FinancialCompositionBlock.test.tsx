import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FinancialCompositionBlock } from '../FinancialCompositionBlock';

describe('<FinancialCompositionBlock />', () => {
  it('renderiza com os 3 valores e formata em BRL', () => {
    render(<FinancialCompositionBlock released={10847} installment={745.84} installments={36} />);
    expect(screen.getByTestId('financial-composition-block')).toBeInTheDocument();
    // Total a pagar: 26.850,24 (aparece nas duas frases)
    expect(screen.getAllByText(/26\.850,24/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/10\.847,00/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Composição financeira/i)).toBeInTheDocument();
    expect(screen.getByText(/O cliente recebe/i)).toBeInTheDocument();
    expect(screen.getByText(/% a\.m\./)).toBeInTheDocument();
  });

  it('não renderiza quando released_value ausente', () => {
    const { container } = render(
      <FinancialCompositionBlock released={null} installment={500} installments={12} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('não renderiza quando installments=0', () => {
    const { container } = render(
      <FinancialCompositionBlock released={1000} installment={100} installments={0} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('usa valores pré-computados do servidor quando fornecidos', () => {
    render(
      <FinancialCompositionBlock
        released={10000}
        installment={500}
        installments={24}
        precomputed={{
          total_paid: 99999.99,
          total_interest: 89999.99,
          markup_pct: 900,
          cet_monthly_pct: 12.34,
          cet_annual_pct: 300.5,
        }}
      />
    );
    expect(screen.getAllByText(/99\.999,99/).length).toBeGreaterThan(0);
    expect(screen.getByText(/12\.34% a\.m\./)).toBeInTheDocument();
    expect(screen.getByText(/900\.0%/)).toBeInTheDocument();
  });

  it('formata zero juros corretamente quando parcela*n == liberado', () => {
    render(<FinancialCompositionBlock released={1200} installment={100} installments={12} />);
    expect(screen.getAllByText(/0\.0%/).length).toBeGreaterThan(0);
  });
});
