import Icon from "./Icon";

function PageHead({ back, onBack, title, right }) {
  return (
    <header className="head">
      {onBack ? (
        <button type="button" className="head-back" onClick={onBack}>
          <Icon name="back" />
          <span>{back}</span>
        </button>
      ) : (
        <span />
      )}
      <h1 className="head-title">{title}</h1>
      <div className="head-right">{right}</div>
    </header>
  );
}

export default PageHead;
