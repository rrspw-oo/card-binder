import Photo from "./Photo";

function CardGrid({ cards, onOpen, label }) {
  return (
    <ul className="grid">
      {cards.map((card) => (
        <li key={card.id}>
          <button type="button" className="tile" onClick={() => onOpen(card)}>
            <Photo blob={card.photo} alt={card.name || card.number} />
            <span className="tile-label">
              <span>{label ? label(card) : card.number}</span>
              {card.qty > 1 && <span className="qty">x{card.qty}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export default CardGrid;
